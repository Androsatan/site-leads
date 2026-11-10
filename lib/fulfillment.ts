import { sendDeliveryEmail } from "@/lib/email";
import { decodeOrder } from "@/lib/order";
import { getProduct } from "@/lib/catalog";

export type FulfillmentResult =
  | { outcome: "missing-email" }
  | { outcome: "unknown-product"; productId: string }
  | { outcome: "sent"; productId: string; emailId?: string };

export type PaidOrder = {
  paymentId: string;
  email: string;
  buyerName?: string;
  /** `id:qtd,id:qtd`, o mesmo valor enviado na cobrança. */
  reference: string;
};

function maskEmail(email: string) {
  const [user, domain] = email.split("@");
  if (!user || !domain) return "email-invalido";
  return `${user.slice(0, 2)}***@${domain}`;
}

/** Total em centavos pelo catálogo atual. `null` se a referência ou algum lead não existir. */
export async function quotedTotalCents(reference: string) {
  const lines = decodeOrder(reference);
  if (!lines) return null;

  let total = 0;
  for (const line of lines) {
    const product = await getProduct(line.productId);
    if (!product) return null;
    total += product.price * 100 * line.quantity;
  }
  return total;
}

/**
 * Envia o CSV depois que o gateway confirmar o Pix.
 * O webhook só deve chamar isto com pagamento já verificado.
 */
export async function fulfillPaidOrder(order: PaidOrder): Promise<FulfillmentResult> {
  const email = order.email.trim();
  if (!email) {
    return { outcome: "missing-email" };
  }

  const lines = decodeOrder(order.reference);
  if (!lines) {
    return { outcome: "unknown-product", productId: order.reference };
  }

  const resolved = [];
  for (const line of lines) {
    const product = await getProduct(line.productId);
    if (!product) {
      return { outcome: "unknown-product", productId: line.productId };
    }
    resolved.push({ product, quantity: line.quantity });
  }

  const leads = resolved
    .map((line) => `${line.product.id}:${line.product.leads}x${line.quantity}`)
    .join(",");
  console.info("[fulfillment] chamando Resend", {
    paymentId: order.paymentId,
    reference: order.reference,
    to: maskEmail(email),
    leads,
  });

  try {
    const sent = await sendDeliveryEmail({
      to: email,
      buyerName: order.buyerName?.trim() || undefined,
      lines: resolved,
      paymentId: order.paymentId,
    });

    console.info("[fulfillment] CSV enviado", {
      paymentId: order.paymentId,
      leads,
      to: maskEmail(email),
      emailId: sent?.id ?? null,
    });

    return { outcome: "sent", productId: resolved[0].product.id, emailId: sent?.id };
  } catch (error) {
    console.error("[fulfillment] falha ao enviar o CSV", {
      paymentId: order.paymentId,
      reference: order.reference,
      to: maskEmail(email),
      leads,
      name: error instanceof Error ? error.name : "unknown",
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
