import { mkdir, readFile, rename, writeFile } from "fs/promises";
import path from "path";

const ROOT = path.join(process.cwd(), "private", "orders");
const ORDER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type PendingOrder = {
  orderId: string;
  reference: string;
  email: string;
  name: string;
  totalCents: number;
  createdAt: string;
};

function orderPath(orderId: string) {
  if (!ORDER_ID.test(orderId)) throw new Error("Pedido inválido.");
  return path.join(ROOT, `${orderId}.json`);
}

const READ_ONLY = new Set(["ENOENT", "EROFS", "EACCES", "EPERM", "ENOTDIR"]);

/** Na Vercel o deploy é só leitura. O pedido local só existe onde o disco aceita a pasta. */
export function canPersistOrders() {
  return !process.env.VERCEL;
}

export async function savePendingOrder(order: PendingOrder) {
  if (!canPersistOrders()) return false;

  try {
    await mkdir(ROOT, { recursive: true });
    const file = orderPath(order.orderId);
    const temp = `${file}.${process.pid}.tmp`;
    await writeFile(temp, `${JSON.stringify(order)}\n`, "utf8");
    await rename(temp, file);
    return true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code && READ_ONLY.has(code)) {
      console.error(`[checkout] pedido local não gravado (${code})`);
      return false;
    }
    throw error;
  }
}

export async function readPendingOrder(orderId: string): Promise<PendingOrder | null> {
  if (!ORDER_ID.test(orderId)) return null;

  try {
    const raw = await readFile(orderPath(orderId), "utf8");
    const data = JSON.parse(raw) as Partial<PendingOrder>;
    if (
      data.orderId !== orderId ||
      typeof data.reference !== "string" ||
      typeof data.email !== "string" ||
      typeof data.name !== "string" ||
      !Number.isInteger(data.totalCents)
    ) {
      return null;
    }
    return data as PendingOrder;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}
