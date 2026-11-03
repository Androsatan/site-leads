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

export async function savePendingOrder(order: PendingOrder) {
  await mkdir(ROOT, { recursive: true });
  const file = orderPath(order.orderId);
  const temp = `${file}.${process.pid}.tmp`;
  await writeFile(temp, `${JSON.stringify(order)}\n`, "utf8");
  await rename(temp, file);
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
