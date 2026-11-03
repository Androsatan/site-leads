import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";

const ROOT = path.join(process.cwd(), "private", "products");

export function productFilePath(fileName: string) {
  if (
    !fileName ||
    fileName.includes("..") ||
    fileName.includes("/") ||
    fileName.includes("\\")
  ) {
    throw new Error("Nome de arquivo inválido");
  }

  const full = path.resolve(ROOT, fileName);
  const relative = path.relative(ROOT, full);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Nome de arquivo inválido");
  }

  return full;
}

export function readProductFile(fileName: string) {
  return readFile(productFilePath(fileName));
}

export async function writeProductFile(fileName: string, content: Buffer) {
  await mkdir(ROOT, { recursive: true });
  await writeFile(productFilePath(fileName), content);
}

export async function deleteProductFile(fileName: string) {
  try {
    await unlink(productFilePath(fileName));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
