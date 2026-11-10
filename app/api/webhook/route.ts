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
function maskEmail(email: string) {
  const [user, domain] = email.split("@");
  if (!user || !domain) return "email-invalido";
  return `${user.slice(0, 2)}***@${domain}`;
}

export async function POST(request: Request) {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(await request.text());
  } catch {
    console.error("[webhook] corpo inválido");
    return NextResponse.json({ error: "Notificação inválida." }, { status: 400 });
  }

  const postedKey = field(params, "apiKey");
  const expectedKey = process.env.PAGHIPER_API_KEY?.trim();
  const notificationId = field(params, "notification_id");
  const transactionId = field(params, "transaction_id", "idTransacao", "id_transacao");
  const fields = [...params.keys()].filter((key) => !/token|api.?key|senha|password/i.test(key));
  console.info("[webhook] POST recebido", {
    transactionId: transactionId || null,
    notificationId: notificationId || null,
    fields,
  });

  if (postedKey && expectedKey && !sameSecret(postedKey, expectedKey)) {
    console.error("[webhook] apiKey do POST não confere");
    return NextResponse.json({ error: "Notificação recusada." }, { status: 401 });
  }

  if (!notificationId || !transactionId) {
    console.error("[webhook] notificação sem identificador", { transactionId: transactionId || null, notificationId: notificationId || null });
    return NextResponse.json({ error: "Notificação sem identificador." }, { status: 400 });
  }

  try {
    const notice = await confirmPixNotification({ transactionId, notificationId });
    const status = await fetchPixStatus(transactionId);
    console.info("[webhook] status PagHiper", {
      transactionId,
      noticeStatus: notice.status,
      statusStatus: status.status,
      noticeValueCents: notice.valueCents,
      statusValueCents: status.valueCents,
      orderId: notice.orderId || null,
      statusOrderId: status.orderId || null,
      payer: maskEmail(notice.payerEmail),
    });

    if (notice.transactionId !== transactionId || status.transactionId !== transactionId) {
      console.error("[webhook] transação divergente", {
        transactionId,
        noticeTransactionId: notice.transactionId,
        statusTransactionId: status.transactionId,
      });
      return NextResponse.json({ error: "Transação divergente." }, { status: 409 });
    }
    if (notice.status !== status.status || notice.valueCents !== status.valueCents) {
      console.error("[webhook] status divergente", {
        transactionId,
        noticeStatus: notice.status,
        statusStatus: status.status,
        noticeValueCents: notice.valueCents,
        statusValueCents: status.valueCents,
      });
      return NextResponse.json({ error: "Status divergente." }, { status: 409 });
    }
    if (status.orderId && status.orderId !== notice.orderId) {
      console.error("[webhook] pedido divergente", { transactionId, noticeOrderId: notice.orderId, statusOrderId: status.orderId });
      return NextResponse.json({ error: "Pedido divergente." }, { status: 409 });
    }
    if (!PAID.has(notice.status)) {
      console.info("[webhook] pagamento ainda não aprovado", { transactionId, status: notice.status });
      return NextResponse.json({ received: true, status: notice.status });
    }

    const pending = await readPendingOrder(notice.orderId);
    const unpacked = await unpackOrderId(notice.orderId);
    console.info("[webhook] referência do order_id", {
      transactionId,
      orderId: notice.orderId || null,
      kind: unpacked.kind,
      reference: unpacked.kind === "reference" ? unpacked.reference : null,
      localOrder: Boolean(pending),
    });

    if (pending && (pending.totalCents !== notice.valueCents || pending.email !== notice.payerEmail)) {
      console.error("[webhook] pedido local não confere", {
        transactionId,
        orderId: notice.orderId,
        localCents: pending.totalCents,
        gatewayCents: notice.valueCents,
        emailConfere: pending.email === notice.payerEmail,
      });
      return NextResponse.json({ error: "Pedido não confere." }, { status: 409 });
    }
    if (pending && unpacked.kind === "reference" && unpacked.reference !== pending.reference) {
      console.error("[webhook] referência não confere com o pedido local", {
        transactionId,
        orderId: notice.orderId,
        embedded: unpacked.reference,
        local: pending.reference,
      });
      return NextResponse.json({ error: "Pedido não confere." }, { status: 409 });
    }

    let reference = pending?.reference ?? "";
    let email = pending?.email ?? "";
    let buyerName = pending?.name;

    if (!pending) {
      if (unpacked.kind === "unknown") {
        console.error("[webhook] lead desconhecido na referência", { transactionId, orderId: notice.orderId });
        return NextResponse.json({ received: true, status: notice.status });
      }
      if (unpacked.kind !== "reference") {
        console.error("[webhook] pedido local ausente e order_id sem referência", { transactionId, orderId: notice.orderId });
        return NextResponse.json({ error: "Pedido não encontrado." }, { status: 500 });
      }

      const quoted = await quotedTotalCents(unpacked.reference);
      if (quoted === null) {
        console.error("[webhook] lead da referência não está no catálogo", { transactionId, reference: unpacked.reference });
        return NextResponse.json({ received: true, status: notice.status });
      }
      if (quoted !== notice.valueCents) {
        console.error("[webhook] valor do catálogo não confere", {
          transactionId,
          reference: unpacked.reference,
          quoted,
          gatewayCents: notice.valueCents,
        });
        return NextResponse.json({ error: "Pedido não confere." }, { status: 409 });
      }

      reference = unpacked.reference;
      email = notice.payerEmail;
      buyerName = notice.payerName;
    }

    console.info("[webhook] chamando fulfillPaidOrder", {
      transactionId: notice.transactionId,
      reference,
      email: maskEmail(email),
      localOrder: Boolean(pending),
    });

    const result = await fulfillPaidOrder({
      paymentId: notice.transactionId,
      email,
      buyerName,
      reference,
    });

    console.info("[webhook] fulfillPaidOrder respondeu", {
      transactionId: notice.transactionId,
      outcome: result.outcome,
      productId: "productId" in result ? result.productId : null,
      emailId: result.outcome === "sent" ? (result.emailId ?? null) : null,
    });

    if (result.outcome === "missing-email") {
      console.error("[webhook] pagador sem e-mail", { transactionId: notice.transactionId });
      return NextResponse.json({ received: true, status: notice.status });
    }
    if (result.outcome === "unknown-product") {
      console.error("[webhook] lead desconhecido", { transactionId: notice.transactionId, productId: result.productId });
      return NextResponse.json({ received: true, status: notice.status });
    }

    return NextResponse.json({ received: true, status: notice.status });
  } catch (error) {
    if (error instanceof MissingEnvError) {
      console.error("[webhook] variável ausente", { envName: error.envName, transactionId });
      return NextResponse.json({ error: "Webhook sem credencial." }, { status: 503 });
    }

    console.error("[webhook] falha ao processar", {
      transactionId,
      name: error instanceof Error ? error.name : "unknown",
      message: error instanceof Error ? error.message : String(error),
    });
    const message = error instanceof PagHiperError ? "Falha ao confirmar o Pix." : "Falha ao entregar o pedido.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export function GET() {
  return NextResponse.json({ ok: true });
}
