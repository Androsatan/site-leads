import { mkdir, readFile, rename, writeFile } from "fs/promises";
import path from "path";
import { listProducts } from "@/lib/catalog";
import { isProductId } from "@/lib/order";
import { listNiches, nicheSlug } from "@/lib/products";

const FILE = path.join(process.cwd(), "private", "niches.json");
const MAX_NICHES = 24;

export type MenuNiche = {
  name: string;
  slug: string;
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

function isMenuNiche(value: unknown): value is MenuNiche {
  if (!value || typeof value !== "object") return false;
  const niche = value as Partial<MenuNiche>;
  return (
    typeof niche.name === "string" &&
    niche.name.trim().length > 0 &&
    typeof niche.slug === "string" &&
    isProductId(niche.slug)
  );
}

async function writeAll(niches: MenuNiche[]) {
  await mkdir(path.dirname(FILE), { recursive: true });
  const temp = `${FILE}.${process.pid}.tmp`;
  await writeFile(temp, `${JSON.stringify(niches, null, 2)}\n`, "utf8");
  await rename(temp, FILE);
}

async function seedFromCatalog() {
  return listNiches(await listProducts());
}

async function readAll() {
  try {
    const raw = await readFile(FILE, "utf8");
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data) || !data.every(isMenuNiche)) {
      throw new Error("Lista de nichos inválida");
    }
    return data;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") throw error;
    const seeded = await seedFromCatalog();
    try {
      await writeAll(seeded);
    } catch (writeError) {
      const writeCode = (writeError as NodeJS.ErrnoException).code;
      if (writeCode === "EROFS" || writeCode === "EACCES" || writeCode === "EPERM") return seeded;
      throw writeError;
    }
    return seeded;
  }
}

export function listMenuNiches() {
  return readAll();
}

export async function getMenuNiche(slug: string) {
  if (!isProductId(slug)) return null;
  const niches = await readAll();
  return niches.find((niche) => niche.slug === slug) ?? null;
}

export function addMenuNiche(name: string) {
  return enqueue(async () => {
    const trimmed = name.trim().replace(/\s+/g, " ");
    if (trimmed.length < 2 || trimmed.length > 60) {
      throw new Error("O nome do nicho precisa ter entre 2 e 60 caracteres.");
    }
    const slug = nicheSlug(trimmed);
    if (!isProductId(slug)) {
      throw new Error("Use letras ou números no nome do nicho.");
    }

    const niches = await readAll();
    if (niches.some((niche) => niche.slug === slug)) {
      throw new Error("Esse submenu já existe.");
    }
    if (niches.length >= MAX_NICHES) {
      throw new Error("O menu já tem o máximo de submenus.");
    }

    const next = niches.concat({ name: trimmed, slug });
    await writeAll(next);
    return next.at(-1)!;
  });
}

export function removeMenuNiche(slug: string) {
  return enqueue(async () => {
    if (!isProductId(slug)) throw new Error("Submenu não encontrado.");
    const niches = await readAll();
    if (!niches.some((niche) => niche.slug === slug)) {
      throw new Error("Submenu não encontrado.");
    }
    await writeAll(niches.filter((niche) => niche.slug !== slug));
  });
}
