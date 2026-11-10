import { createHash, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { MissingEnvError } from "@/lib/env";
import { quotedTotalCents, fulfillPaidOrder } from "@/lib/fulfillment";
import { unpackOrderId } from "@/lib/gateway-order";
import { confirmPixNotification, fetchPixStatus, PagHiperError } from "@/lib/paghiper";
import { readPendingOrder } from "@/lib/pending-order";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAID = new Set(["paid", "completed"]);

function sameSecret(input: string, expected: string) {
  const left = createHash("sha256").update(input).digest();
  const right = createHash("sha256").update(expected).digest();
  return timingSafeEqual(left, right);
}

function field(params: URLSearchParams, ...names: string[]) {
  for (const name of names) {
    const value = params.get(name)?.trim();
    if (value) return value;
  }
  return "";
}

/**
 * O PagHiper avisa esta rota com um POST application/x-www-form-urlencoded.
 * A apiKey e o token recebidos não autenticam nada: a confirmação é a
 * consulta na API com as credenciais do servidor.
 * O CSV só sai com status paid ou completed.
 */
export async function POST(request: Request) {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(await request.text());
  } catch {
    return NextResponse.json({ error: "Notificação inválida." }, { status: 400 });
  }

  const postedKey = field(params, "apiKey");
  const expectedKey = process.env.PAGHIPER_API_KEY?.trim();
  if (postedKey && expectedKey && !sameSecret(postedKey, expectedKey)) {
    return NextResponse.json({ error: "Notificação recusada." }, { status: 401 });
  }

  const notificationId = field(params, "notification_id");
  const transactionId = field(params, "transaction_id", "idTransacao", "id_transacao");
  if (!notificationId || !transactionId) {
    return NextResponse.json({ error: "Notificação sem identificador." }, { status: 400 });
  }

  try {
    const notice = await confirmPixNotification({ transactionId, notificationId });
    const status = await fetchPixStatus(transactionId);

    if (notice.transactionId !== transactionId || status.transactionId !== transactionId) {
      return NextResponse.json({ error: "Transação divergente." }, { status: 409 });
    }
    if (notice.status !== status.status || notice.valueCents !== status.valueCents) {
      return NextResponse.json({ error: "Status divergente." }, { status: 409 });
    }
    if (status.orderId && status.orderId !== notice.orderId) {
      return NextResponse.json({ error: "Pedido divergente." }, { status: 409 });
    }
    if (!PAID.has(notice.status)) {
      return NextResponse.json({ received: true, status: notice.status });
    }

    const pending = await readPendingOrder(notice.orderId);
    const unpacked = await unpackOrderId(notice.orderId);

    if (pending && (pending.totalCents !== notice.valueCents || pending.email !== notice.payerEmail)) {
      console.error(`[webhook] pedido não confere order=${notice.orderId}`);
      return NextResponse.json({ error: "Pedido não confere." }, { status: 409 });
    }
    if (pending && unpacked.kind === "reference" && unpacked.reference !== pending.reference) {
      console.error(`[webhook] referência não confere order=${notice.orderId}`);
      return NextResponse.json({ error: "Pedido não confere." }, { status: 409 });
    }

    let reference = pending?.reference ?? "";
    let email = pending?.email ?? "";
    let buyerName = pending?.name;

    if (!pending) {
      if (unpacked.kind === "unknown") {
        console.error(`[webhook] lead desconhecido order=${notice.orderId}`);
        return NextResponse.json({ received: true, status: notice.status });
      }
      if (unpacked.kind !== "reference") {
        console.error(`[webhook] pedido local ausente order=${notice.orderId}`);
        return NextResponse.json({ error: "Pedido não encontrado." }, { status: 500 });
      }

      const quoted = await quotedTotalCents(unpacked.reference);
      if (quoted === null) {
        console.error(`[webhook] lead desconhecido order=${notice.orderId}`);
        return NextResponse.json({ received: true, status: notice.status });
      }
      if (quoted !== notice.valueCents) {
        console.error(`[webhook] pedido não confere order=${notice.orderId}`);
        return NextResponse.json({ error: "Pedido não confere." }, { status: 409 });
      }

      reference = unpacked.reference;
      email = notice.payerEmail;
      buyerName = notice.payerName;
    }

    const result = await fulfillPaidOrder({
      paymentId: notice.transactionId,
      email,
      buyerName,
      reference,
    });

    if (result.outcome === "missing-email") {
      console.error(`[webhook] pagador sem e-mail transaction=${notice.transactionId}`);
      return NextResponse.json({ received: true, status: notice.status });
    }
    if (result.outcome === "unknown-product") {
      console.error(`[webhook] lead desconhecido: ${result.productId}`);
      return NextResponse.json({ received: true, status: notice.status });
    }

    return NextResponse.json({ received: true, status: notice.status });
  } catch (error) {
    if (error instanceof MissingEnvError) {
      console.error(`[webhook] variável ausente: ${error.envName}`);
      return NextResponse.json({ error: "Webhook sem credencial." }, { status: 503 });
    }

    console.error("[webhook]", error instanceof Error ? error.message : error);
    const message = error instanceof PagHiperError ? "Falha ao confirmar o Pix." : "Falha ao entregar o pedido.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export function GET() {
  return NextResponse.json({ ok: true });
}
