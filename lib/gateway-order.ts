import { createHash, randomBytes } from "crypto";
import { listProducts } from "@/lib/catalog";
import { decodeOrder, encodeOrder, parseQuantity, type OrderLine } from "@/lib/order";

/** Limite do `order_id` no PagHiper. */
export const ORDER_ID_LIMIT = 64;

const NONCE = /^[0-9a-f]{6}$/;
const TOKEN = /^[0-9a-f]{4,32}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type UnpackedOrder =
  | { kind: "reference"; reference: string }
  | { kind: "unknown" }
  | { kind: "absent" };

/**
 * Cabe a referência `id:qtd,id:qtd` no order_id.
 * Um sufixo `|` + 6 hex deixa cobranças iguais distintas.
 * Se o texto não cabe em 64 caracteres, os ids viram um prefixo de SHA-256
 * (`~hash:qtd`) que o catálogo consegue abrir de volta.
 * `null` quando nem a forma compacta cabe.
 */
export async function packOrderId(reference: string): Promise<string | null> {
  const lines = decodeOrder(reference);
  if (!lines) return null;

  const nonce = randomBytes(3).toString("hex");
  const literal = fit(reference, nonce);
  if (literal) return literal;

  const products = await listProducts();
  return compactOrderId(
    lines,
    products.map((product) => product.id),
    nonce,
  );
}

/** Recupera `id:qtd,id:qtd` a partir do order_id ecoado pelo gateway. */
export async function unpackOrderId(orderId: string): Promise<UnpackedOrder> {
  if (!orderId || orderId.length > ORDER_ID_LIMIT) return { kind: "absent" };

  const body = stripNonce(orderId);
  if (!body || UUID.test(body)) return { kind: "absent" };
  if (body.startsWith("~")) return expandCompact(body);
  if (decodeOrder(body)) return { kind: "reference", reference: body };
  return { kind: "absent" };
}

function fit(body: string, nonce: string) {
  const unique = `${body}|${nonce}`;
  if (unique.length <= ORDER_ID_LIMIT) return unique;
  if (body.length <= ORDER_ID_LIMIT) return body;
  return null;
}

function stripNonce(orderId: string) {
  const cut = orderId.lastIndexOf("|");
  if (cut <= 0) return orderId;
  const nonce = orderId.slice(cut + 1);
  if (!NONCE.test(nonce)) return orderId;
  return orderId.slice(0, cut);
}

function productHash(id: string) {
  return createHash("sha256").update(id).digest("hex");
}

function isUnique(token: string, hashes: Map<string, string>) {
  let count = 0;
  for (const hash of hashes.values()) {
    if (hash.startsWith(token)) count += 1;
  }
  return count === 1;
}

function compactBody(lines: OrderLine[], hashes: Map<string, string>, length: number | "min") {
  const items: string[] = [];

  for (const line of lines) {
    const full = hashes.get(line.productId);
    if (!full) return null;

    let token: string | null = null;
    if (length === "min") {
      for (let size = 4; size <= 32; size++) {
        const candidate = full.slice(0, size);
        if (isUnique(candidate, hashes)) {
          token = candidate;
          break;
        }
      }
    } else if (isUnique(full.slice(0, length), hashes)) {
      token = full.slice(0, length);
    }
    if (!token) return null;
    items.push(`${token}:${line.quantity}`);
  }

  return `~${items.join(",")}`;
}

function compactOrderId(lines: OrderLine[], productIds: string[], nonce: string) {
  const hashes = new Map(productIds.map((id) => [id, productHash(id)]));
  const wide = compactBody(lines, hashes, 8);
  const short = compactBody(lines, hashes, "min");
  for (const body of [wide, short]) {
    if (!body) continue;
    const fitted = fit(body, nonce);
    if (fitted) return fitted;
  }
  return null;
}

async function expandCompact(body: string): Promise<UnpackedOrder> {
  const parts = body.slice(1).split(",");
  if (parts.length === 0 || parts.some((part) => part.length === 0)) {
    return { kind: "absent" };
  }

  const products = await listProducts();
  const hashes = products.map((product) => ({ id: product.id, hash: productHash(product.id) }));
  const lines: OrderLine[] = [];

  for (const part of parts) {
    const cut = part.indexOf(":");
    const token = cut === -1 ? "" : part.slice(0, cut);
    const quantity = cut === -1 ? null : parseQuantity(part.slice(cut + 1));
    if (!TOKEN.test(token) || quantity === null) return { kind: "absent" };

    const matches = hashes.filter((item) => item.hash.startsWith(token));
    if (matches.length !== 1) return { kind: "unknown" };
    lines.push({ productId: matches[0].id, quantity });
  }

  const reference = encodeOrder(lines);
  if (!decodeOrder(reference)) return { kind: "absent" };
  return { kind: "reference", reference };
}
