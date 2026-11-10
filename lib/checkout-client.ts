import type { OrderLine } from "@/lib/order";

export type Payer = {
  name: string;
  email: string;
  cpfCnpj: string;
};

export type PixPayment = {
  pixCode: string;
  qrcodeImageUrl: string;
  transactionId: string;
};

export type PixStatus = {
  paid: boolean;
  status: string;
};

export async function requestCheckout(items: OrderLine[], payer: Payer): Promise<PixPayment> {
  const response = await fetch("/api/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      items,
      payerName: payer.name,
      payerEmail: payer.email,
      payerCpfCnpj: payer.cpfCnpj,
    }),
  });
  const data = (await response.json()) as {
    pix_code?: string;
    qrcode_image_url?: string;
    transaction_id?: string;
    error?: string;
  };

  if (!response.ok || !data.pix_code || !data.qrcode_image_url || !data.transaction_id) {
    throw new Error(data.error || "Não foi possível gerar o Pix.");
  }

  return { pixCode: data.pix_code, qrcodeImageUrl: data.qrcode_image_url, transactionId: data.transaction_id };
}

export async function requestPixStatus(transactionId: string): Promise<PixStatus> {
  const response = await fetch(`/api/checkout/status?transaction=${encodeURIComponent(transactionId)}`, {
    cache: "no-store",
  });
  const data = (await response.json()) as { paid?: boolean; status?: string; error?: string };
  if (!response.ok || typeof data.status !== "string") {
    throw new Error(data.error || "Não foi possível consultar o pagamento.");
  }
  return { paid: Boolean(data.paid), status: data.status };
}
