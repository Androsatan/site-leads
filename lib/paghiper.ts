import { MissingEnvError, requireEnv } from "@/lib/env";

const CREATE_URL = "https://pix.paghiper.com/invoice/create/";
const NOTIFICATION_URL = "https://pix.paghiper.com/invoice/notification/";
const STATUS_URL = "https://pix.paghiper.com/invoice/status/";

export class PagHiperError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PagHiperError";
  }
}

export type PixChargeItem = {
  item_id: string;
  description: string;
  quantity: number;
  price_cents: string;
};

export type PixCharge = {
  pixCode: string;
  qrcodeImageUrl: string;
  transactionId: string;
  valueCents: number;
};

type PixCode = {
  emv?: unknown;
  qrcode_image_url?: unknown;
  qrcode_base64?: unknown;
};

type PagHiperEnvelope = {
  result?: unknown;
  response_message?: unknown;
  transaction_id?: unknown;
  order_id?: unknown;
  status?: unknown;
  value_cents?: unknown;
  payer_email?: unknown;
  payer_name?: unknown;
  pix_code?: PixCode;
};

export type PixStatus = {
  status: string;
  orderId: string;
  payerEmail: string;
  payerName: string;
  valueCents: number;
  transactionId: string;
};

function credentials() {
  return {
    apiKey: requireEnv("PAGHIPER_API_KEY"),
    token: requireEnv("PAGHIPER_TOKEN"),
  };
}

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function messageOf(payload: PagHiperEnvelope | undefined, fallback: string) {
  const message = asText(payload?.response_message);
  return message || fallback;
}

async function postPagHiper(url: string, body: Record<string, unknown>) {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof MissingEnvError) throw error;
    throw new PagHiperError("O PagHiper não respondeu.");
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new PagHiperError("O PagHiper devolveu uma resposta inválida.");
  }

  return { response, payload };
}

function envelope(payload: unknown, key: string): PagHiperEnvelope {
  if (!payload || typeof payload !== "object" || !(key in payload)) return {};
  const value = (payload as Record<string, unknown>)[key];
  return value && typeof value === "object" ? (value as PagHiperEnvelope) : {};
}

function qrImage(pix: PixCode | undefined) {
  const url = asText(pix?.qrcode_image_url);
  if (/^https:\/\/pix\.paghiper\.com\//.test(url)) return url;

  const base64 = asText(pix?.qrcode_base64);
  if (/^[A-Za-z0-9+/=]+$/.test(base64) && base64.length > 100 && base64.length < 20_000) {
    return `data:image/png;base64,${base64}`;
  }

  return "";
}

export async function createPixInvoice(input: {
  orderId: string;
  payerEmail: string;
  payerName: string;
  payerCpfCnpj: string;
  notificationUrl: string;
  items: PixChargeItem[];
}) {
  const { apiKey, token } = credentials();
  const { response, payload } = await postPagHiper(CREATE_URL, {
    apiKey,
    token,
    order_id: input.orderId,
    payer_email: input.payerEmail,
    payer_name: input.payerName,
    payer_cpf_cnpj: input.payerCpfCnpj,
    notification_url: input.notificationUrl,
    days_due_date: 1,
    items: input.items,
  });

  const created = envelope(payload, "pix_create_request");
  const pixCode = asText(created.pix_code?.emv);
  const qrcodeImageUrl = qrImage(created.pix_code);
  const valueCents = Number(created.value_cents);

  if (!response.ok || asText(created.result) !== "success" || !pixCode.startsWith("000201") || !qrcodeImageUrl) {
    throw new PagHiperError(messageOf(created, "Não foi possível gerar o Pix."));
  }

  return {
    pixCode,
    qrcodeImageUrl,
    transactionId: asText(created.transaction_id),
    valueCents,
  } satisfies PixCharge;
}

/** Confirma a notificação. O status e o pedido vêm da API, não do POST recebido. */
export async function confirmPixNotification(input: { transactionId: string; notificationId: string }) {
  const { apiKey, token } = credentials();
  const { response, payload } = await postPagHiper(NOTIFICATION_URL, {
    apiKey,
    token,
    transaction_id: input.transactionId,
    notification_id: input.notificationId,
  });
  const notice = envelope(payload, "status_request");

  if (!response.ok || asText(notice.result) !== "success") {
    throw new PagHiperError(messageOf(notice, "Não foi possível confirmar a notificação."));
  }

  return readStatus(notice, input.transactionId);
}

/** Consulta o status pelo transaction_id. A API não aceita notification_id neste endpoint. */
export async function fetchPixStatus(transactionId: string) {
  const { apiKey, token } = credentials();
  const { response, payload } = await postPagHiper(STATUS_URL, {
    apiKey,
    token,
    transaction_id: transactionId,
  });
  const status = envelope(payload, "status_request");

  if (!response.ok || asText(status.result) !== "success") {
    throw new PagHiperError(messageOf(status, "Não foi possível consultar o Pix."));
  }

  return {
    status: asText(status.status).toLowerCase(),
    valueCents: Number(status.value_cents),
    transactionId: asText(status.transaction_id) || transactionId,
    orderId: asText(status.order_id),
  };
}

function readStatus(notice: PagHiperEnvelope, transactionId: string): PixStatus {
  const valueCents = Number(notice.value_cents);
  return {
    status: asText(notice.status).toLowerCase(),
    orderId: asText(notice.order_id),
    payerEmail: asText(notice.payer_email).toLowerCase(),
    payerName: asText(notice.payer_name),
    valueCents: Number.isFinite(valueCents) ? valueCents : 0,
    transactionId: asText(notice.transaction_id) || transactionId,
  };
}
