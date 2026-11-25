import { NextResponse } from "next/server";
import { MissingEnvError } from "@/lib/env";
import { quotedTotalCents, fulfillPaidOrder } from "@/lib/fulfillment";
import { markPurchaseDelivery, readPurchase, rememberPurchase } from "@/lib/purchases";
import { unpackOrderId } from "@/lib/gateway-order";
import {
  fetchOrder,
  isPaidOrder,
  MercadoPagoError,
  MP_ORDER_ID,
  verifyWebhookSignature,
} from "@/lib/mercadopago";
import { readPendingOrder } from "@/lib/pending-order";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function maskEmail(email: string) {
  const [user, domain] = email.split("@");
  if (!user || !domain) return "email-invalido";
  return `${user.slice(0, 2)}***@${domain}`;
}

function readJson(text: string): Record<string, unknown> {
  try {
    const value = JSON.parse(text) as unknown;
    return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "";
}

/**
 * O Mercado Pago avisa esta rota com um POST JSON e `?data.id=ORD...&type=order`.
 * O corpo do aviso não autentica nada: o pagamento só vale depois da consulta
 * `GET /v1/orders/{id}` com o token do servidor. Se a assinatura secreta estiver
 * configurada, o header `x-signature` também precisa conferir.
 * O e-mail do pagador vem do pedido local ou do histórico gravado no checkout,
 * porque a order não devolve o pagador.
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const body = readJson(await request.text().catch(() => ""));
  const bodyData = body.data && typeof body.data === "object" ? (body.data as Record<string, unknown>) : {};

  const dataId = url.searchParams.get("data.id")?.trim() || text(bodyData.id);
  const type = url.searchParams.get("type")?.trim() || text(body.type);
  const action = text(body.action);
  console.info("[webhook] POST recebido", { type: type || null, action: action || null, dataId: dataId || null });

  if (type !== "order") {
    console.info("[webhook] aviso ignorado (não é order)", { type: type || null });
    return NextResponse.json({ received: true, ignored: true });
  }
  if (!MP_ORDER_ID.test(dataId)) {
    console.error("[webhook] aviso sem identificador válido");
    return NextResponse.json({ error: "Notificação sem identificador." }, { status: 400 });
  }

  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim();
  if (secret) {
    const valid = verifyWebhookSignature({
      signature: request.headers.get("x-signature") ?? "",
      requestId: request.headers.get("x-request-id") ?? "",
      dataId: url.searchParams.get("data.id")?.trim() || dataId,
      secret,
    });
    if (!valid) {
      console.error("[webhook] x-signature não confere", { dataId });
      return NextResponse.json({ error: "Notificação recusada." }, { status: 401 });
    }
  } else {
    console.warn("[webhook] MERCADOPAGO_WEBHOOK_SECRET ausente; validando só pela consulta da order", { dataId });
  }

  let recordedTransaction: string | null = null;

  try {
    const order = await fetchOrder(dataId);
    console.info("[webhook] order consultada no Mercado Pago", {
      dataId,
      status: order.status,
      statusDetail: order.statusDetail,
      totalCents: order.totalCents,
      paidCents: order.paidCents,
      externalReference: order.externalReference || null,
    });

    if (order.id !== dataId) {
      console.error("[webhook] order divergente", { dataId, orderId: order.id });
      return NextResponse.json({ error: "Transação divergente." }, { status: 409 });
    }
    if (!isPaidOrder(order)) {
      console.info("[webhook] pagamento ainda não aprovado", { dataId, status: order.status, statusDetail: order.statusDetail });
      return NextResponse.json({ received: true, status: order.status });
    }

    const transactionId = order.id;
    const pending = await readPendingOrder(order.externalReference);
    const stored = await readPurchase(transactionId);
    const unpacked = await unpackOrderId(order.externalReference);
    console.info("[webhook] referência do external_reference", {
      transactionId,
      kind: unpacked.kind,
      reference: unpacked.kind === "reference" ? unpacked.reference : null,
      localOrder: Boolean(pending),
      storedPurchase: Boolean(stored),
    });

    if (unpacked.kind === "unknown") {
      console.error("[webhook] lead desconhecido na referência", { transactionId });
      return NextResponse.json({ received: true, status: order.status });
    }

    const reference = pending?.reference ?? (unpacked.kind === "reference" ? unpacked.reference : "");
    if (!reference) {
      console.error("[webhook] order sem referência de itens", { transactionId });
      return NextResponse.json({ received: true, status: order.status });
    }
    if (pending && unpacked.kind === "reference" && unpacked.reference !== pending.reference) {
      console.error("[webhook] referência não confere com o pedido local", {
        transactionId,
        embedded: unpacked.reference,
        local: pending.reference,
      });
      return NextResponse.json({ error: "Pedido não confere." }, { status: 409 });
    }

    // Valor: o pedido local ou o histórico gravado no checkout; sem nenhum dos dois, o catálogo.
    const expectedCents = pending?.totalCents ?? stored?.totalCents ?? (await quotedTotalCents(reference));
    if (expectedCents === null) {
      console.error("[webhook] lead da referência não está no catálogo", { transactionId, reference });
      return NextResponse.json({ received: true, status: order.status });
    }
    if (expectedCents !== order.totalCents) {
      console.error("[webhook] valor não confere", {
        transactionId,
        reference,
        expectedCents,
        gatewayCents: order.totalCents,
        source: pending ? "pedido-local" : stored ? "historico" : "catalogo",
      });
      return NextResponse.json({ error: "Pedido não confere." }, { status: 409 });
    }

    const email = pending?.email || stored?.email || "";
    const buyerName = pending?.name || stored?.buyerName || undefined;
    if (!email) {
      // Pode ser o histórico ainda não visível. A nova tentativa do gateway resolve.
      console.error("[webhook] e-mail do pagador não encontrado (sem pedido local nem histórico)", { transactionId });
      return NextResponse.json({ error: "Pedido não encontrado." }, { status: 500 });
    }

    const saved = await rememberPurchase({
      transactionId,
      email,
      buyerName,
      reference,
      totalCents: order.totalCents,
    });
    if (saved) recordedTransaction = transactionId;

    console.info("[webhook] chamando fulfillPaidOrder", {
      transactionId,
      reference,
      email: maskEmail(email),
      localOrder: Boolean(pending),
      purchaseSaved: saved,
    });

    const result = await fulfillPaidOrder({
      paymentId: transactionId,
      email,
      buyerName,
      reference,
    });
    if (recordedTransaction) {
      await markPurchaseDelivery(recordedTransaction, result.outcome === "sent" ? "enviado" : "falhou");
    }

    console.info("[webhook] fulfillPaidOrder respondeu", {
      transactionId,
      outcome: result.outcome,
      productId: "productId" in result ? result.productId : null,
      emailId: result.outcome === "sent" ? (result.emailId ?? null) : null,
    });

    if (result.outcome === "missing-email") {
      console.error("[webhook] pagador sem e-mail", { transactionId });
    }
    if (result.outcome === "unknown-product") {
      console.error("[webhook] lead desconhecido", { transactionId, productId: result.productId });
    }

    return NextResponse.json({ received: true, status: order.status });
  } catch (error) {
    if (recordedTransaction) {
      await markPurchaseDelivery(recordedTransaction, "falhou").catch((markError) => {
        console.error("[purchases] não foi possível marcar a falha de envio", {
          transactionId: recordedTransaction,
          message: markError instanceof Error ? markError.message : String(markError),
        });
      });
    }
    if (error instanceof MissingEnvError) {
      console.error("[webhook] variável ausente", { envName: error.envName, dataId });
      return NextResponse.json({ error: "Webhook sem credencial." }, { status: 503 });
    }

    console.error("[webhook] falha ao processar", {
      dataId,
      name: error instanceof Error ? error.name : "unknown",
      message: error instanceof Error ? error.message : String(error),
    });
    const message = error instanceof MercadoPagoError ? "Falha ao confirmar o Pix." : "Falha ao entregar o pedido.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export function GET() {
  return NextResponse.json({ ok: true });
}
