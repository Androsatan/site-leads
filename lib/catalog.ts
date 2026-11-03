import { mkdir, readFile, rename, unlink, writeFile } from "fs/promises";
import path from "path";
import { seedProducts } from "@/lib/catalog-seed";
import { deleteProductFile, writeProductFile } from "@/lib/product-file";
import { isProductId } from "@/lib/order";
import type { Product } from "@/lib/products";

const FILE = path.join(process.cwd(), "private", "catalog.json");

export type NewProductInput = {
  name: string;
  niche: string;
  city: string;
  state: string;
  price: number;
  description: string;
  fields: string[];
  highlight?: string;
  featured?: boolean;
  csv: Buffer;
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

function isProduct(value: unknown): value is Product {
  if (!value || typeof value !== "object") return false;
  const product = value as Partial<Product>;
  return (
    typeof product.id === "string" &&
    isProductId(product.id) &&
    typeof product.name === "string" &&
    typeof product.niche === "string" &&
    typeof product.city === "string" &&
    typeof product.state === "string" &&
    typeof product.leads === "number" &&
    Number.isInteger(product.price) &&
    typeof product.fileName === "string" &&
    Array.isArray(product.fields) &&
    typeof product.description === "string"
  );
}

async function writeAll(products: Product[]) {
  await mkdir(path.dirname(FILE), { recursive: true });
  const temp = `${FILE}.${process.pid}.tmp`;
  await writeFile(temp, `${JSON.stringify(products, null, 2)}\n`, "utf8");
  await rename(temp, FILE);
}

async function readAll() {
  try {
    const raw = await readFile(FILE, "utf8");
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data) || !data.every(isProduct)) {
      throw new Error("Catálogo inválido");
    }
    return data;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") throw error;
    await writeAll(seedProducts);
    return seedProducts;
  }
}

export function listProducts() {
  return readAll();
}

export async function getProduct(id: string) {
  const products = await readAll();
  return products.find((product) => product.id === id);
}

export async function getFeaturedProduct() {
  const products = await readAll();
  return products.find((product) => product.featured) ?? products[0];
}

function slugify(value: string) {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug;
}

function countContacts(csv: Buffer) {
  const text = csv.toString("utf8").replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  return Math.max(0, lines.length - 1);
}

export function addProduct(input: NewProductInput) {
  return enqueue(async () => {
    const leads = countContacts(input.csv);
    if (leads < 1) {
      throw new Error("O CSV precisa ter um cabeçalho e ao menos um contato.");
    }

    const products = await readAll();
    let id = slugify(input.name);
    if (!id) throw new Error("Dê um nome ao lead.");
    let suffix = 2;
    while (products.some((product) => product.id === id)) {
      id = `${slugify(input.name).slice(0, 44)}-${suffix}`;
      suffix += 1;
    }

    const fileName = `${id}.csv`;
    const product: Product = {
      id,
      name: input.name,
      niche: input.niche,
      city: input.city,
      state: input.state,
      leads,
      price: input.price,
      fileName,
      fields: input.fields,
      description: input.description,
      ...(input.highlight ? { highlight: input.highlight } : {}),
      ...(input.featured ? { featured: true } : {}),
    };

    const next = input.featured
      ? products.map((item) => ({ ...item, featured: false }))
      : products.slice();
    next.push(product);

    await writeProductFile(fileName, input.csv);
    try {
      await writeAll(next);
    } catch (error) {
      await unlink(path.join(process.cwd(), "private", "products", fileName)).catch(() => undefined);
      throw error;
    }

    return product;
  });
}

export function removeProduct(id: string) {
  return enqueue(async () => {
    const products = await readAll();
    const product = products.find((item) => item.id === id);
    if (!product) throw new Error("Lead não encontrado.");

    const next = products.filter((item) => item.id !== id);
    await writeAll(next);

    const stillUsed = next.some((item) => item.fileName === product.fileName);
    if (!stillUsed) {
      await deleteProductFile(product.fileName);
    }
  });
}
