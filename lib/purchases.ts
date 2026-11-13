import { mkdir, readFile, rename, writeFile } from "fs/promises";
import path from "path";
import { get, list, put } from "@vercel/blob";
import { getProduct } from "@/lib/catalog";
import { decodeOrder } from "@/lib/order";

const FILE = path.join(process.cwd(), "private", "purchases.json");
const BLOB_PREFIX = "purchases/";
const TRANSACTION_ID = /^[A-Za-z0-9]{10,32}$/;
export type PurchaseItem = {
  productId: string;
  name: string;
  quantity: number;
  /** Preço unitário em reais, no momento do pagamento. */
  unitPrice: number;
  /** Contatos pedidos: quantidade do lead vezes a quantidade comprada. */
  contacts: number;
};

export type PurchaseDelivery = "pendente" | "enviado" | "falhou";
export type PurchasePayment = "aguardando" | "pago";

export type Purchase = {
  transactionId: string;
  createdAt: string;
  paidAt?: string;
  buyerName: string;
  email: string;
  method: "pix";
  totalCents: number;
  items: PurchaseItem[];
  payment: PurchasePayment;
  delivery: PurchaseDelivery;
};

export type PurchaseInput = {
  transactionId: string;
  email: string;
  buyerName?: string;
  reference: string;
  totalCents: number;
};

let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(task: () => Promise<T>) {
  const run = queue.then(task, task);
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function isItem(value: unknown): value is PurchaseItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<PurchaseItem>;
  return (
    typeof item.productId === "string" &&
    typeof item.name === "string" &&
    Number.isInteger(item.quantity) &&
    Number.isInteger(item.unitPrice) &&
    Number.isInteger(item.contacts)
  );
}

function parsePurchase(value: unknown): Purchase | null {
  if (!value || typeof value !== "object") return null;
  const purchase = value as Partial<Purchase> & { paidAt?: unknown; createdAt?: unknown; payment?: unknown };
  const paidAt = typeof purchase.paidAt === "string" ? purchase.paidAt : undefined;
  const createdAt = typeof purchase.createdAt === "string" ? purchase.createdAt : paidAt;
  const payment: PurchasePayment | null =
    purchase.payment === "aguardando" ? "aguardando" : purchase.payment === "pago" || purchase.payment === undefined ? "pago" : null;
  if (
    typeof purchase.transactionId !== "string" ||
    !TRANSACTION_ID.test(purchase.transactionId) ||
    !createdAt ||
    typeof purchase.buyerName !== "string" ||
    typeof purchase.email !== "string" ||
    purchase.method !== "pix" ||
    !Number.isInteger(purchase.totalCents) ||
    (purchase.delivery !== "pendente" && purchase.delivery !== "enviado" && purchase.delivery !== "falhou") ||
    !payment ||
    !Array.isArray(purchase.items) ||
    !purchase.items.every(isItem)
  ) {
    return null;
  }

  return {
    transactionId: purchase.transactionId,
    createdAt,
    ...(payment === "pago" ? { paidAt: paidAt ?? createdAt } : {}),
    buyerName: purchase.buyerName,
    email: purchase.email,
    method: "pix",
    totalCents: purchase.totalCents as number,
    items: purchase.items,
    payment,
    delivery: purchase.delivery,
  };
}

function blobToken() {
  return process.env.BLOB_READ_WRITE_TOKEN?.trim() || "";
}

/** O site publicado usa o Blob da Vercel. Sem esse token, o histórico fica no disco local. */
export function purchaseStoreMode(): "blob" | "file" | "missing" {
  if (blobToken()) return "blob";
  if (process.env.VERCEL) return "missing";
  return "file";
}

function blobPath(transactionId: string) {
  return `${BLOB_PREFIX}${transactionId}.json`;
}

async function readBlobText(pathname: string) {
  const result = await get(pathname, { access: "private", useCache: false });
  if (!result || result.statusCode !== 200 || !result.stream) return null;
  return new Response(result.stream).text();
}

async function readBlobPurchase(transactionId: string) {
  const raw = await readBlobText(blobPath(transactionId));
  if (!raw) return null;
  return parsePurchase(JSON.parse(raw));
}

async function writeBlobPurchase(purchase: Purchase) {
  await put(blobPath(purchase.transactionId), JSON.stringify(purchase), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 60,
  });
}

async function listBlobPurchases() {
  const purchases: Purchase[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: BLOB_PREFIX, cursor, limit: 1000 });
    const parsed = await Promise.all(
      page.blobs.map(async (blob) => {
        try {
          const raw = await readBlobText(blob.pathname);
          return raw ? parsePurchase(JSON.parse(raw)) : null;
        } catch (error) {
          console.error("[purchases] registro ilegível", {
            pathname: blob.pathname,
            message: error instanceof Error ? error.message : String(error),
          });
          return null;
        }
      }),
    );
    for (const purchase of parsed) {
      if (purchase) purchases.push(purchase);
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return purchases;
}

async function readFilePurchases() {
  try {
    const raw = await readFile(FILE, "utf8");
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) throw new Error("Histórico de compras inválido");
    const purchases = data.map(parsePurchase);
    if (purchases.some((purchase) => purchase === null)) {
      throw new Error("Histórico de compras inválido");
    }
    return purchases as Purchase[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function writeFilePurchases(purchases: Purchase[]) {
  await mkdir(path.dirname(FILE), { recursive: true });
  const temp = `${FILE}.${process.pid}.tmp`;
  await writeFile(temp, `${JSON.stringify(purchases, null, 2)}\n`, "utf8");
  await rename(temp, FILE);
}

async function readOne(transactionId: string) {
  if (purchaseStoreMode() === "blob") return readBlobPurchase(transactionId);
  const purchases = await readFilePurchases();
  return purchases.find((purchase) => purchase.transactionId === transactionId) ?? null;
}

async function writeOne(purchase: Purchase) {
  if (purchaseStoreMode() === "blob") {
    await writeBlobPurchase(purchase);
    return;
  }
  const purchases = await readFilePurchases();
  const index = purchases.findIndex((current) => current.transactionId === purchase.transactionId);
  if (index === -1) purchases.push(purchase);
  else purchases[index] = purchase;
  await writeFilePurchases(purchases);
}

function diskCode(error: unknown) {
  return (error as NodeJS.ErrnoException).code;
}

function cannotPersist() {
  return purchaseStoreMode() === "missing";
}

async function snapshotItems(reference: string): Promise<PurchaseItem[]> {
  const lines = decodeOrder(reference) ?? [];
  const items: PurchaseItem[] = [];
  for (const line of lines) {
    const product = await getProduct(line.productId);
    items.push({
      productId: line.productId,
      name: product?.name ?? line.productId,
      quantity: line.quantity,
      unitPrice: product?.price ?? 0,
      contacts: (product?.leads ?? 0) * line.quantity,
    });
  }
  return items;
}

function cleanPurchaseInput(input: PurchaseInput) {
  if (!TRANSACTION_ID.test(input.transactionId) || !Number.isInteger(input.totalCents) || input.totalCents < 0) {
    return null;
  }
  return {
    transactionId: input.transactionId,
    email: input.email.trim().toLowerCase().slice(0, 255),
    buyerName: (input.buyerName ?? "").trim().replace(/\s+/g, " ").slice(0, 255),
    reference: input.reference,
    totalCents: input.totalCents,
  };
}

function logSkipped(transactionId: string) {
  console.error("[purchases] compra ignorada", { transactionId: transactionId || null });
}

function logUnstored(transactionId: string, error?: unknown) {
  console.error("[purchases] histórico não gravado", {
    transactionId,
    ...(error
      ? {
          code: diskCode(error) ?? null,
          message: error instanceof Error ? error.message : String(error),
        }
      : { reason: purchaseStoreMode() === "missing" ? "blob" : "disco" }),
  });
}

/** Grava o Pix assim que a cobrança existe, ainda sem pagamento. */
export function rememberPendingPurchase(input: PurchaseInput) {
  return enqueue(async () => {
    const clean = cleanPurchaseInput(input);
    if (!clean) {
      logSkipped(input.transactionId);
      return false;
    }
    if (cannotPersist()) {
      logUnstored(clean.transactionId);
      return false;
    }

    try {
      if (await readOne(clean.transactionId)) return true;

      const purchase: Purchase = {
        transactionId: clean.transactionId,
        createdAt: new Date().toISOString(),
        buyerName: clean.buyerName,
        email: clean.email,
        method: "pix",
        totalCents: clean.totalCents,
        items: await snapshotItems(clean.reference),
        payment: "aguardando",
        delivery: "pendente",
      };
      await writeOne(purchase);
      console.info("[purchases] aguardando pagamento", {
        transactionId: clean.transactionId,
        items: purchase.items.length,
        totalCents: purchase.totalCents,
      });
      return true;
    } catch (error) {
      logUnstored(clean.transactionId, error);
      return false;
    }
  });
}

/**
 * Marca a compra como paga. Se o Pix não tinha histórico, cria o registro já pago.
 * Retorna false quando o disco não aceita o arquivo. Não interrompe a entrega do CSV.
 */
export function rememberPurchase(input: PurchaseInput) {
  return enqueue(async () => {
    const clean = cleanPurchaseInput(input);
    if (!clean) {
      logSkipped(input.transactionId);
      return false;
    }
    if (cannotPersist()) {
      logUnstored(clean.transactionId);
      return false;
    }

    try {
      const current = await readOne(clean.transactionId);
      if (current) {
        if (current.payment === "pago") return true;
        current.payment = "pago";
        current.paidAt = new Date().toISOString();
        await writeOne(current);
        console.info("[purchases] pagamento confirmado", { transactionId: clean.transactionId });
        return true;
      }

      const now = new Date().toISOString();
      const purchase: Purchase = {
        transactionId: clean.transactionId,
        createdAt: now,
        paidAt: now,
        buyerName: clean.buyerName,
        email: clean.email,
        method: "pix",
        totalCents: clean.totalCents,
        items: await snapshotItems(clean.reference),
        payment: "pago",
        delivery: "pendente",
      };
      await writeOne(purchase);
      console.info("[purchases] compra gravada", {
        transactionId: clean.transactionId,
        items: purchase.items.length,
        totalCents: purchase.totalCents,
      });
      return true;
    } catch (error) {
      logUnstored(clean.transactionId, error);
      return false;
    }
  });
}

/** Não rebaixa um envio que já deu certo. */
export function markPurchaseDelivery(transactionId: string, delivery: PurchaseDelivery) {
  return enqueue(async () => {
    if (!TRANSACTION_ID.test(transactionId) || cannotPersist()) return false;

    try {
      const current = await readOne(transactionId);
      if (!current || current.delivery === delivery) return Boolean(current);
      if (current.delivery === "enviado") return true;
      current.delivery = delivery;
      await writeOne(current);
      console.info("[purchases] envio atualizado", { transactionId, delivery });
      return true;
    } catch (error) {
      console.error("[purchases] envio não atualizado", {
        transactionId,
        code: diskCode(error) ?? null,
        message: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  });
}

export async function listPurchases() {
  if (purchaseStoreMode() === "missing") return [];
  const purchases = purchaseStoreMode() === "blob" ? await listBlobPurchases() : await readFilePurchases();
  return purchases.slice().sort((a, b) => {
    const left = a.paidAt ?? a.createdAt;
    const right = b.paidAt ?? b.createdAt;
    return right.localeCompare(left) || b.transactionId.localeCompare(a.transactionId);
  });
}
