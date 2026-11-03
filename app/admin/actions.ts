"use server";

import { redirect } from "next/navigation";
import { isAdmin, checkAdminPassword, endAdminSession, startAdminSession, adminPasswordConfigured } from "@/lib/admin-session";
import { addProduct, removeProduct } from "@/lib/catalog";

const CSV_LIMIT = 5 * 1024 * 1024;

async function requireAdmin() {
  if (!(await isAdmin())) redirect("/admin/login");
}

function text(formData: FormData, name: string, max: number) {
  const value = String(formData.get(name) ?? "").trim().replace(/\s+/g, " ");
  return value.slice(0, max);
}

export async function login(
  _previous: { error: string },
  formData: FormData,
): Promise<{ error: string }> {
  if (!adminPasswordConfigured()) {
    return { error: "Defina ADMIN_PASSWORD no arquivo .env e reinicie o servidor." };
  }

  const password = String(formData.get("password") ?? "");
  if (!checkAdminPassword(password)) {
    return { error: "Senha incorreta." };
  }

  await startAdminSession();
  redirect("/admin");
}

export async function logout() {
  await endAdminSession();
  redirect("/admin/login");
}

export async function createProduct(
  _previous: { error: string },
  formData: FormData,
): Promise<{ error: string }> {
  await requireAdmin();

  const name = text(formData, "name", 80);
  const niche = text(formData, "niche", 60);
  const city = text(formData, "city", 60);
  const state = text(formData, "state", 8).toUpperCase();
  const description = text(formData, "description", 400);
  const highlight = text(formData, "highlight", 24);
  const price = Number(String(formData.get("price") ?? "").trim());
  const fields = String(formData.get("fields") ?? "")
    .split(",")
    .map((field) => field.trim().replace(/\s+/g, " "))
    .filter(Boolean)
    .slice(0, 12);
  const file = formData.get("csv");

  if (!name || !niche || !city || !state || !description) {
    return { error: "Preencha nome, nicho, cidade, estado e descrição." };
  }
  if (!Number.isInteger(price) || price < 1 || price > 100000) {
    return { error: "O preço precisa ser um valor inteiro em reais." };
  }
  if (fields.length === 0) {
    return { error: "Informe ao menos uma coluna do CSV." };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Envie o arquivo CSV deste lead." };
  }
  if (file.size > CSV_LIMIT) {
    return { error: "O CSV passa de 5 MB." };
  }
  if (!file.name.toLowerCase().endsWith(".csv")) {
    return { error: "O arquivo precisa terminar em .csv." };
  }

  const csv = Buffer.from(await file.arrayBuffer());
  if (csv.includes(0)) {
    return { error: "O arquivo não parece um CSV de texto." };
  }

  try {
    await addProduct({
      name,
      niche,
      city,
      state,
      price,
      description,
      fields,
      highlight: highlight || undefined,
      featured: formData.get("featured") === "on",
      csv,
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível salvar o lead." };
  }

  redirect("/admin");
}

export async function deleteProduct(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  try {
    await removeProduct(id);
  } catch (error) {
    console.error("[admin] remover", error);
  }
  redirect("/admin");
}
