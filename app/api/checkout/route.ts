import { NextResponse } from "next/server";
import { MissingEnvError, appUrl, isHttpsApp } from "@/lib/env";
import { checkoutUrl, mercadoPago } from "@/lib/mercadopago";
import { encodeOrder, isProductId, mergeLines, parseQuantity, type OrderLine } from "@/lib/order";
import { getProduct } from "@/lib/products";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CheckoutBody = {
  productId?: unknown;
  quantity?: unknown;
  items?: unknown;
};

function readOrder(body: CheckoutBody): { lines: OrderLine[] } | { error: string; status: number } {
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
      if (!isProductId(productId) || !getProduct(productId)) {
        return { error: "Lead não encontrado.", status: 404 };
      }
      if (!quantity) {
        return { error: "Quantidade inválida.", status: 400 };
      }
      raw.push({ productId, quantity });
    }
  } else if (typeof body.productId === "string") {
    const quantity = body.quantity === undefined ? 1 : parseQuantity(body.quantity);
    if (!isProductId(body.productId) || !getProduct(body.productId)) {
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

  const order = readOrder(body);
  if ("error" in order) {
    return NextResponse.json({ error: order.error }, { status: order.status });
  }

  const items = order.lines.map((line) => {
    const product = getProduct(line.productId)!;
    return {
      id: product.id,
      title: product.name,
      description: product.description,
      quantity: line.quantity,
      unit_price: product.price,
      currency_id: "BRL",
    };
  });
  const reference = encodeOrder(order.lines);

  try {
    const mp = mercadoPago();
    const base = appUrl();
    const preference = await mp.preference.create({
      body: {
        items,
        external_reference: reference,
        metadata: { order: reference },
        statement_descriptor: "LEADSfera",
        back_urls: {
          success: `${base}/sucesso`,
          failure: `${base}/falha`,
          pending: `${base}/pendente`,
        },
        ...(isHttpsApp()
          ? {
              auto_return: "approved" as const,
              notification_url: `${base}/api/webhook`,
            }
          : {}),
      },
    });

    const url = checkoutUrl(mp.accessToken, preference);
    if (!url) {
      console.error("[checkout] preferência sem init_point", preference.id);
      return NextResponse.json(
        { error: "O checkout não devolveu o link de pagamento." },
        { status: 502 },
      );
    }

    return NextResponse.json({ url, preferenceId: preference.id });
  } catch (error) {
    if (error instanceof MissingEnvError) {
      return NextResponse.json(
        { error: `Configure ${error.envName} no arquivo .env e reinicie o servidor.` },
        { status: 503 },
      );
    }

    console.error("[checkout]", error);
    return NextResponse.json(
      { error: "Não foi possível abrir o checkout." },
      { status: 500 },
    );
  }
}
