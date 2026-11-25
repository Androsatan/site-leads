import { createHmac, timingSafeEqual } from "crypto";
import { requireEnv } from "@/lib/env";

/**
 * Cliente do Mercado Pago, API de Orders (Checkout Transparente, Pix).
 * Só roda no servidor. O visitante nunca vê o nome do gateway.
 */
const ORDERS_URL = "https://api.mercadopago.com/v1/orders";

/** `ORD...` (produção) ou `ORDTST...` (teste). */
export const MP_ORDER_ID = /^[A-Za-z0-9]{10,64}$/;

export class MercadoPagoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MercadoPagoError";
  }
}

export type PixChargeItem = {
  productId: string;
  title: string;
  quantity: number;
  unitCents: number;
};

export type PixCharge = {
  pixCode: string;
  qrcodeImageUrl: string;
  transactionId: string;
  valueCents: number;
};

export type MpOrder = {
  id: string;
  status: string;
  statusDetail: string;
  externalReference: string;
  totalCents: number;
  paidCents: number;
};

function accessToken() {
  return requireEnv("MERCADOPAGO_ACCESS_TOKEN");
}

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** "50.00" → 5000. Valor ausente ou inválido vira NaN. */
function toCents(value: unknown) {
  const text = asText(value);
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return Number.NaN;
  return Math.round(Number(text) * 100);
}

function toAmount(cents: number) {
  return (cents / 100).toFixed(2);
}

function errorMessage(payload: unknown, fallback: string) {
  const first = asObject(Array.isArray(asObject(payload).errors) ? (asObject(payload).errors as unknown[])[0] : null);
  const code = asText(first.code);
  const details = Array.isArray(first.details) ? first.details.filter((item) => typeof item === "string").join("; ") : "";
  const message = asText(first.message) || asText(asObject(payload).message);
  return [fallback, code, message, details].filter(Boolean).join(" | ");
}

/** Device ID gerado pelo security.js no navegador do comprador. */
const DEVICE_ID = /^[A-Za-z0-9._:-]{1,1024}$/;

/** Nome que aparece no extrato do comprador (até 13 caracteres). */
const STATEMENT_DESCRIPTOR = "LEADSFERA";

async function callOrders(
  url: string,
  init: { method: "GET" | "POST"; body?: unknown; idempotencyKey?: string; deviceId?: string },
) {
  const headers: Record<string, string> = {
    Accept: "application/json",
    Authorization: `Bearer ${accessToken()}`,
  };
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  if (init.idempotencyKey) headers["X-Idempotency-Key"] = init.idempotencyKey;
  if (init.deviceId && DEVICE_ID.test(init.deviceId)) headers["X-meli-session-id"] = init.deviceId;

  let response: Response;
  try {
    response = await fetch(url, {
      method: init.method,
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
  } catch {
    throw new MercadoPagoError("O Mercado Pago não respondeu.");
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new MercadoPagoError(`O Mercado Pago devolveu uma resposta inválida (HTTP ${response.status}).`);
  }

  return { response, payload };
}

function qrImage(base64: string) {
  if (/^[A-Za-z0-9+/=]+$/.test(base64) && base64.length > 100 && base64.length < 50_000) {
    return `data:image/png;base64,${base64}`;
  }
  return "";
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  const first = parts.shift() ?? "";
  return { first_name: first.slice(0, 100), last_name: parts.join(" ").slice(0, 100) || undefined };
}

export async function createPixOrder(input: {
  externalReference: string;
  idempotencyKey: string;
  payerEmail: string;
  payerName: string;
  payerCpfCnpj: string;
  items: PixChargeItem[];
  totalCents: number;
  deviceId?: string;
}): Promise<PixCharge> {
  const amount = toAmount(input.totalCents);
  const { response, payload } = await callOrders(ORDERS_URL, {
    method: "POST",
    idempotencyKey: input.idempotencyKey,
    deviceId: input.deviceId,
    body: {
      type: "online",
      processing_mode: "automatic",
      external_reference: input.externalReference,
      total_amount: amount,
      expiration_time: "P1D",
      description: "LeadSfera",
      config: { statement_descriptor: STATEMENT_DESCRIPTOR },
      payer: {
        email: input.payerEmail,
        ...splitName(input.payerName),
        identification: {
          type: input.payerCpfCnpj.length === 14 ? "CNPJ" : "CPF",
          number: input.payerCpfCnpj,
        },
      },
      items: input.items.map((item) => ({
        title: item.title.slice(0, 150),
        unit_price: toAmount(item.unitCents),
        quantity: item.quantity,
        external_code: item.productId.slice(0, 64),
      })),
      transactions: {
        payments: [{ amount, payment_method: { id: "pix", type: "bank_transfer" } }],
      },
    },
  });

  if (!response.ok) {
    throw new MercadoPagoError(errorMessage(payload, `Falha ao criar a order (HTTP ${response.status}).`));
  }

  const order = asObject(payload);
  const payments = asObject(order.transactions).payments;
  const payment = asObject(Array.isArray(payments) ? payments[0] : null);
  const method = asObject(payment.payment_method);
  const pixCode = asText(method.qr_code);
  const qrcodeImageUrl = qrImage(asText(method.qr_code_base64));
  const transactionId = asText(order.id);

  if (!MP_ORDER_ID.test(transactionId) || !pixCode.startsWith("000201") || !qrcodeImageUrl) {
    throw new MercadoPagoError(
      `Order sem Pix utilizável (status ${asText(order.status) || "?"}/${asText(order.status_detail) || "?"}).`,
    );
  }

  return {
    pixCode,
    qrcodeImageUrl,
    transactionId,
    valueCents: toCents(order.total_amount),
  };
}

/** Consulta a order com o token do servidor. É a única fonte de verdade do pagamento. */
export async function fetchOrder(orderId: string): Promise<MpOrder> {
  if (!MP_ORDER_ID.test(orderId)) throw new MercadoPagoError("Identificador de order inválido.");

  const { response, payload } = await callOrders(`${ORDERS_URL}/${encodeURIComponent(orderId)}`, { method: "GET" });
  if (!response.ok) {
    throw new MercadoPagoError(errorMessage(payload, `Falha ao consultar a order (HTTP ${response.status}).`));
  }

  const order = asObject(payload);
  return {
    id: asText(order.id),
    status: asText(order.status).toLowerCase(),
    statusDetail: asText(order.status_detail).toLowerCase(),
    externalReference: asText(order.external_reference),
    totalCents: toCents(order.total_amount),
    paidCents: toCents(order.total_paid_amount),
  };
}

/** Pago de verdade: processada, creditada e com o valor inteiro recebido. */
export function isPaidOrder(order: MpOrder) {
  return (
    order.status === "processed" &&
    order.statusDetail === "accredited" &&
    Number.isInteger(order.totalCents) &&
    order.totalCents > 0 &&
    order.paidCents === order.totalCents
  );
}

function sameHex(left: string, right: string) {
  const a = Buffer.from(left, "hex");
  const b = Buffer.from(right, "hex");
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

/**
 * Valida o header `x-signature` (`ts=...,v1=...`).
 * Manifesto: `id:{data.id};request-id:{x-request-id};ts:{ts};`, HMAC-SHA256 com a assinatura secreta.
 * A documentação pede o `data.id` em minúsculas quando é alfanumérico; aceitamos as duas formas.
 */
export function verifyWebhookSignature(input: {
  signature: string;
  requestId: string;
  dataId: string;
  secret: string;
}) {
  let ts = "";
  let v1 = "";
  for (const part of input.signature.split(",")) {
    const [key, ...rest] = part.split("=");
    const value = rest.join("=").trim();
    if (key?.trim() === "ts") ts = value;
    if (key?.trim() === "v1") v1 = value.toLowerCase();
  }
  if (!ts || !/^[0-9a-f]{64}$/.test(v1)) return false;

  const ids = new Set([input.dataId, input.dataId.toLowerCase()]);
  for (const id of ids) {
    const parts = [id ? `id:${id};` : "", input.requestId ? `request-id:${input.requestId};` : "", `ts:${ts};`];
    const expected = createHmac("sha256", input.secret).update(parts.join("")).digest("hex");
    if (sameHex(expected, v1)) return true;
  }
  return false;
}
