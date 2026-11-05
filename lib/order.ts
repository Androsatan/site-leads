/** Pedido cobrado no checkout. Preço e quantidade são conferidos no servidor. */

export const MAX_QUANTITY = 999;

const PRODUCT_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type OrderLine = {
  productId: string;
  quantity: number;
};

export function isProductId(value: string) {
  return PRODUCT_ID.test(value);
}

export function parseQuantity(value: unknown): number | null {
  let quantity: number;
  if (typeof value === "number") {
    quantity = value;
  } else if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    quantity = Number(value);
  } else {
    return null;
  }

  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
    return null;
  }

  return quantity;
}

/** Soma linhas repetidas. `null` quando a soma passa do máximo. */
export function mergeLines(lines: OrderLine[]): OrderLine[] | null {
  const totals = new Map<string, number>();

  for (const line of lines) {
    const next = (totals.get(line.productId) ?? 0) + line.quantity;
    if (next > MAX_QUANTITY) return null;
    totals.set(line.productId, next);
  }

  return [...totals.entries()].map(([productId, quantity]) => ({ productId, quantity }));
}

export function encodeOrder(lines: OrderLine[]) {
  return lines.map((line) => `${line.productId}:${line.quantity}`).join(",");
}

export function checkoutPath(lines: OrderLine[], origin?: "carrinho") {
  const params = new URLSearchParams({ pedido: encodeOrder(lines) });
  if (origin) params.set("origem", origin);
  return `/checkout?${params.toString()}`;
}

/** Aceita `id:qtd,id:qtd` e também um id solto de pedidos antigos. */
export function decodeOrder(reference: string): OrderLine[] | null {
  const value = reference.trim();
  if (!value || value.length > 256) return null;

  if (!value.includes(":") && !value.includes(",")) {
    return isProductId(value) ? [{ productId: value, quantity: 1 }] : null;
  }

  const seen = new Set<string>();
  const lines: OrderLine[] = [];

  for (const part of value.split(",")) {
    const [productId, quantityText, extra] = part.split(":");
    const quantity = quantityText ? parseQuantity(quantityText) : null;
    if (!productId || !quantity || extra !== undefined || !isProductId(productId) || seen.has(productId)) {
      return null;
    }
    seen.add(productId);
    lines.push({ productId, quantity });
  }

  return lines.length > 0 ? lines : null;
}
