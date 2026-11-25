import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { MissingEnvError } from "@/lib/env";
import { packOrderId } from "@/lib/gateway-order";
import { encodeOrder, isProductId, mergeLines, parseQuantity, type OrderLine } from "@/lib/order";
import { getProduct } from "@/lib/catalog";
import { createPixOrder, type PixChargeItem } from "@/lib/mercadopago";
import { savePendingOrder } from "@/lib/pending-order";
import { rememberPendingPurchase } from "@/lib/purchases";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIN_CENTS = 300;

type CheckoutBody = {
  productId?: unknown;
  quantity?: unknown;
  items?: unknown;
  payerName?: unknown;
  payerEmail?: unknown;
  payerCpfCnpj?: unknown;
  deviceId?: unknown;
};

function digits(value: string) {
  return value.replace(/\D/g, "");
}

function readPayer(body: CheckoutBody): { name: string; email: string; cpfCnpj: string } | { error: string } {
  const name = typeof body.payerName === "string" ? body.payerName.trim().replace(/\s+/g, " ") : "";
  const email = typeof body.payerEmail === "string" ? body.payerEmail.trim().toLowerCase() : "";
  const cpfCnpj = typeof body.payerCpfCnpj === "string" ? digits(body.payerCpfCnpj) : "";

  if (name.length < 3 || name.length > 255) {
    return { error: "Informe o nome completo de quem vai pagar." };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) {
    return { error: "Informe um e-mail válido para receber o CSV." };
  }
  if (cpfCnpj.length !== 11 && cpfCnpj.length !== 14) {
    return { error: "Informe um CPF ou CNPJ válido, só com números." };
  }

  return { name, email, cpfCnpj };
}

async function readOrder(body: CheckoutBody): Promise<{ lines: OrderLine[] } | { error: string; status: number }> {
  const raw: OrderLine[] = [];

  if (Array.isArray(body.items)) {
    if (body.items.length === 0) {
      return { error: "Escolha ao menos um lead.", status: 400 };
    }
    if (body.items.length > 20) {
      return { error: "Pedido grande demais.", status: 400 };
    }

    for (const item of body.items) {
      if (!item || typeof item !== "object") {
        return { error: "Pedido inválido.", status: 400 };
      }
      const productId = "productId" in item && typeof item.productId === "string" ? item.productId : "";
      const quantity = "quantity" in item ? parseQuantity(item.quantity) : null;
      if (!isProductId(productId) || !(await getProduct(productId))) {
        return { error: "Lead não encontrado.", status: 404 };
      }
      if (!quantity) {
        return { error: "Quantidade inválida.", status: 400 };
      }
      raw.push({ productId, quantity });
    }
  } else if (typeof body.productId === "string") {
    const quantity = body.quantity === undefined ? 1 : parseQuantity(body.quantity);
    if (!isProductId(body.productId) || !(await getProduct(body.productId))) {
      return { error: "Lead não encontrado.", status: 404 };
    }
    if (!quantity) {
      return { error: "Quantidade inválida.", status: 400 };
    }
    raw.push({ productId: body.productId, quantity });
  } else {
    return { error: "Pedido inválido.", status: 400 };
  }

  const lines = mergeLines(raw);
  if (!lines) {
    return { error: "Quantidade inválida.", status: 400 };
  }

  return { lines };
}

export async function POST(request: Request) {
  let body: CheckoutBody;
  try {
    body = (await request.json()) as CheckoutBody;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const payer = readPayer(body);
  if ("error" in payer) {
    return NextResponse.json({ error: payer.error }, { status: 400 });
  }

  const order = await readOrder(body);
  if ("error" in order) {
    return NextResponse.json({ error: order.error }, { status: order.status });
  }

  const items: PixChargeItem[] = [];
  let totalCents = 0;
  for (const line of order.lines) {
    const product = await getProduct(line.productId);
    if (!product) {
      return NextResponse.json({ error: "Lead não encontrado." }, { status: 404 });
    }
    const priceCents = product.price * 100;
    totalCents += priceCents * line.quantity;
    items.push({
      productId: product.id,
      title: product.name,
      quantity: line.quantity,
      unitCents: priceCents,
    });
  }

  if (totalCents < MIN_CENTS) {
    return NextResponse.json({ error: "O Pix exige no mínimo R$ 3,00." }, { status: 400 });
  }

  const reference = encodeOrder(order.lines);
  const orderId = await packOrderId(reference);
  if (!orderId) {
    console.error("[checkout] referência não cabe no external_reference", {
      items: order.lines.length,
      length: reference.length,
    });
    return NextResponse.json(
      { error: "Esse pedido não cabe no Pix. Remova um lead e tente de novo." },
      { status: 400 },
    );
  }

  // O Mercado Pago não aceita notification_url por order: o webhook fica no painel.
  console.info("[checkout] criando order no Mercado Pago", {
    orderId,
    reference,
    totalCents,
    items: order.lines.length,
    deviceIdLength: typeof body.deviceId === "string" ? body.deviceId.length : 0,
  });

  try {
    const charge = await createPixOrder({
      externalReference: orderId,
      idempotencyKey: randomUUID(),
      payerEmail: payer.email,
      payerName: payer.name,
      payerCpfCnpj: payer.cpfCnpj,
      items,
      totalCents,
      deviceId: typeof body.deviceId === "string" ? body.deviceId : undefined,
    });

    if (!charge.transactionId || charge.valueCents !== totalCents) {
      console.error("[checkout] cobrança divergente", {
        orderId,
        transactionId: charge.transactionId || null,
        expected: totalCents,
        received: charge.valueCents,
      });
      return NextResponse.json({ error: "O valor do Pix não confere com o pedido." }, { status: 502 });
    }

    const saved = await savePendingOrder({
      orderId,
      reference,
      email: payer.email,
      name: payer.name,
      totalCents,
      createdAt: new Date().toISOString(),
    });
    if (!saved) {
      console.info("[checkout] pedido local não gravado; a entrega usa o order_id", { orderId });
    }

    const remembered = await rememberPendingPurchase({
      transactionId: charge.transactionId,
      email: payer.email,
      buyerName: payer.name,
      reference,
      totalCents,
    });
    // A order do Mercado Pago não devolve o e-mail do pagador. Sem o histórico
    // (Blob ou disco) nem o pedido local, o webhook não teria para quem enviar o CSV.
    if (!remembered && !saved) {
      console.error("[checkout] Pix não exibido: nem histórico nem pedido local gravados", {
        transactionId: charge.transactionId,
        orderId,
      });
      return NextResponse.json({ error: "Não foi possível gerar o Pix agora." }, { status: 503 });
    }

    console.info("[checkout] Pix criado", {
      transactionId: charge.transactionId,
      orderId,
      totalCents,
    });

    return NextResponse.json({
      pix_code: charge.pixCode,
      qrcode_image_url: charge.qrcodeImageUrl,
      transaction_id: charge.transactionId,
    });
  } catch (error) {
    if (error instanceof MissingEnvError) {
      console.error("[checkout] variável ausente", { envName: error.envName });
      return NextResponse.json(
        { error: "Não foi possível gerar o Pix agora." },
        { status: 503 },
      );
    }

    console.error("[checkout] falha ao gerar o Pix", {
      orderId,
      name: error instanceof Error ? error.name : "unknown",
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Não foi possível gerar o Pix agora." },
      { status: 502 },
    );
  }
}
