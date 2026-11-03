import { NextResponse } from "next/server";
import { appUrl, isHttpsApp } from "@/lib/env";
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
      quantity: line.quantity,
      unitPrice: product.price,
    };
  });
  const total = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const reference = encodeOrder(order.lines);
  const notificationUrl = isHttpsApp() ? `${appUrl()}/api/webhook` : null;

  // TODO: Asaas ou PagHiper — criar a cobrança Pix.
  // - Valor: `total` em reais, sempre do catálogo, nunca do navegador.
  // - Itens: `items`.
  // - Referência externa: `reference` (`id:qtd,id:qtd`) para o webhook achar o pedido.
  // - notificationUrl: `notificationUrl` (null em http; em https aponta para /api/webhook).
  // - Responder { url } com o link do pagamento para o navegador redirecionar.
  void items;
  void total;
  void reference;
  void notificationUrl;

  return NextResponse.json(
    { error: "O pagamento Pix ainda não está ligado." },
    { status: 501 },
  );
}
