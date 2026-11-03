import { NextResponse } from "next/server";
import { fulfillPayment } from "@/lib/fulfillment";
import { verifyMercadoPagoSignature } from "@/lib/signature";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type WebhookPayload = {
  type?: string;
  action?: string;
  data?: { id?: string | number };
};

function asId(value: unknown) {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

/**
 * Mercado Pago avisa esta rota quando um pagamento muda de estado.
 * Só disparamos o e-mail com status "approved". A página /sucesso
 * não envia arquivo — qualquer pessoa poderia abri-la.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const raw = await request.text();

  let payload: WebhookPayload | null = null;
  if (raw) {
    try {
      payload = JSON.parse(raw) as WebhookPayload;
    } catch {
      payload = null;
    }
  }

  const topic =
    payload?.type || url.searchParams.get("type") || url.searchParams.get("topic") || "";
  const action = payload?.action ?? "";
  const isPayment = topic === "payment" || action.startsWith("payment.");

  if (topic && !isPayment) {
    return NextResponse.json({ received: true, ignored: topic });
  }

  const paymentId =
    asId(url.searchParams.get("data.id")) ||
    asId(payload?.data?.id) ||
    asId(url.searchParams.get("id"));

  if (!paymentId) {
    return NextResponse.json({ received: true, ignored: "missing-id" });
  }

  const secret = process.env.MP_WEBHOOK_SECRET?.trim();
  if (secret) {
    const valid = verifyMercadoPagoSignature(request.headers, paymentId, secret);
    if (!valid) {
      return NextResponse.json({ error: "Assinatura inválida." }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    console.error("[webhook] MP_WEBHOOK_SECRET ausente em produção");
    return NextResponse.json({ error: "Webhook sem segredo." }, { status: 401 });
  } else {
    console.warn("[webhook] MP_WEBHOOK_SECRET ausente — assinatura não verificada (só em dev)");
  }

  try {
    const result = await fulfillPayment(paymentId);

    if (result.outcome === "missing-email") {
      console.error(`[webhook] pagamento ${paymentId} aprovado sem e-mail do pagador`);
      return NextResponse.json({ error: "Pagador sem e-mail." }, { status: 500 });
    }

    if (result.outcome === "unknown-product") {
      console.error(`[webhook] external_reference desconhecida: ${result.productId}`);
    }

    return NextResponse.json({ received: true, result: result.outcome });
  } catch (error) {
    console.error("[webhook]", error);
    return NextResponse.json({ error: "Falha ao entregar o pedido." }, { status: 500 });
  }
}

export function GET() {
  return NextResponse.json({ ok: true });
}
