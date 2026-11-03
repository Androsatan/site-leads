import { sendDeliveryEmail } from "@/lib/email";
import { mercadoPago } from "@/lib/mercadopago";
import { decodeOrder } from "@/lib/order";
import { getProduct } from "@/lib/products";

type Payer = {
  email?: string;
  first_name?: string;
};

type ApprovedPayment = {
  id?: number | string;
  status?: string;
  external_reference?: string;
  metadata?: { order?: unknown };
  payer?: Payer;
};

export type FulfillmentResult =
  | { outcome: "ignored"; status?: string }
  | { outcome: "missing-email" }
  | { outcome: "unknown-product"; productId: string }
  | { outcome: "sent"; productId: string; emailId?: string };

function maskEmail(email: string) {
  const [user, domain] = email.split("@");
  if (!user || !domain) return "email-invalido";
  return `${user.slice(0, 2)}***@${domain}`;
}

export async function fulfillPayment(paymentId: string): Promise<FulfillmentResult> {
  const mp = mercadoPago();
  const payment = (await mp.payment.get({ id: paymentId })) as ApprovedPayment;

  if (payment.status !== "approved") {
    return { outcome: "ignored", status: payment.status };
  }

  const email = payment.payer?.email?.trim();
  if (!email) {
    return { outcome: "missing-email" };
  }

  const metadataOrder = typeof payment.metadata?.order === "string" ? payment.metadata.order : "";
  const reference = payment.external_reference?.trim() || metadataOrder.trim();
  const order = decodeOrder(reference);
  if (!order) {
    return { outcome: "unknown-product", productId: reference };
  }

  const lines = [];
  for (const line of order) {
    const product = getProduct(line.productId);
    if (!product) {
      return { outcome: "unknown-product", productId: line.productId };
    }
    lines.push({ product, quantity: line.quantity });
  }

  const sent = await sendDeliveryEmail({
    to: email,
    buyerName: payment.payer?.first_name?.trim() || undefined,
    lines,
    paymentId: String(payment.id ?? paymentId),
  });

  console.info(
    `[webhook] CSV enviado pagamento=${paymentId} leads=${lines.map((line) => line.product.id).join(",")} para=${maskEmail(email)}`,
  );

  return { outcome: "sent", productId: lines[0].product.id, emailId: sent?.id };
}
