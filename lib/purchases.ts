import { mkdir, readFile, rename, writeFile } from "fs/promises";
import path from "path";
import { getProduct } from "@/lib/catalog";
import { decodeOrder } from "@/lib/order";

const FILE = path.join(process.cwd(), "private", "purchases.json");
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

async function readAll() {
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

async function writeAll(purchases: Purchase[]) {
  await mkdir(path.dirname(FILE), { recursive: true });
  const temp = `${FILE}.${process.pid}.tmp`;
  await writeFile(temp, `${JSON.stringify(purchases, null, 2)}\n`, "utf8");
  await rename(temp, FILE);
}

function diskCode(error: unknown) {
  return (error as NodeJS.ErrnoException).code;
}

/** Na Vercel o arquivo some. O histórico fica no disco desta máquina. */
function cannotPersist() {
  return Boolean(process.env.VERCEL);
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
      : { reason: "disco" }),
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
      const purchases = await readAll();
      if (purchases.some((purchase) => purchase.transactionId === clean.transactionId)) return true;

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
      purchases.push(purchase);
      await writeAll(purchases);
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
      const purchases = await readAll();
      const current = purchases.find((purchase) => purchase.transactionId === clean.transactionId);
      if (current) {
        if (current.payment === "pago") return true;
        current.payment = "pago";
        current.paidAt = new Date().toISOString();
        await writeAll(purchases);
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
      purchases.push(purchase);
      await writeAll(purchases);
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
      const purchases = await readAll();
      const current = purchases.find((purchase) => purchase.transactionId === transactionId);
      if (!current || current.delivery === delivery) return Boolean(current);
      if (current.delivery === "enviado") return true;
      current.delivery = delivery;
      await writeAll(purchases);
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
  const purchases = await readAll();
  return purchases.slice().sort((a, b) => {
    const left = a.paidAt ?? a.createdAt;
    const right = b.paidAt ?? b.createdAt;
    return right.localeCompare(left) || b.transactionId.localeCompare(a.transactionId);
  });
}
