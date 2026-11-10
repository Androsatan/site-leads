"use server";

import { redirect } from "next/navigation";
import { isAdmin, checkAdminPassword, endAdminSession, startAdminSession, adminPasswordConfigured } from "@/lib/admin-session";
import { addProduct, removeProduct, setProductFeatured, updateProduct } from "@/lib/catalog";
import { addMenuNiche, removeMenuNiche as deleteMenuNiche } from "@/lib/menu-niches";
import { isProductId } from "@/lib/order";

const CSV_LIMIT = 5 * 1024 * 1024;

async function requireAdmin() {
  if (!(await isAdmin())) redirect("/admin/login");
}

function text(formData: FormData, name: string, max: number) {
  const value = String(formData.get(name) ?? "").trim().replace(/\s+/g, " ");
  return value.slice(0, max);
}

type ProductFields = {
  name: string;
  niche: string;
  city: string;
  state: string;
  description: string;
  highlight?: string;
  price: number;
  fields: string[];
  featured: boolean;
  leads?: number;
};

function readProductFields(formData: FormData): ProductFields | { error: string } {
  const name = text(formData, "name", 80);
  const niche = text(formData, "niche", 60);
  const city = text(formData, "city", 60);
  const state = text(formData, "state", 8).toUpperCase();
  const description = text(formData, "description", 400);
  const highlight = text(formData, "highlight", 24);
  const price = Number(String(formData.get("price") ?? "").trim());
  const leadsText = String(formData.get("leads") ?? "").trim();
  const leads = leadsText === "" ? undefined : Number(leadsText);
  const listed = formData.getAll("field").map((value) => String(value));
  const source = listed.length > 0 ? listed : String(formData.get("fields") ?? "").split(",");
  const fields: string[] = [];
  for (const value of source) {
    const field = value.trim().replace(/\s+/g, " ").slice(0, 40);
    if (field && !fields.includes(field)) fields.push(field);
    if (fields.length === 12) break;
  }

  if (!name || !niche || !city || !state || !description) {
    return { error: "Preencha nome, nicho, cidade, estado e descrição." };
  }
  if (!Number.isInteger(price) || price < 1 || price > 100000) {
    return { error: "O preço precisa ser um valor inteiro em reais." };
  }
  if (leads !== undefined && (!Number.isInteger(leads) || leads < 1 || leads > 1_000_000)) {
    return { error: "Informe a quantidade de contatos com um número inteiro." };
  }
  if (fields.length === 0) {
    return { error: "Informe ao menos uma tag." };
  }

  return {
    name,
    niche,
    city,
    state,
    description,
    highlight: highlight || undefined,
    price,
    fields,
    featured: formData.get("featured") === "on",
    leads,
  };
}

async function readCsv(formData: FormData, required: boolean): Promise<Buffer | undefined | { error: string }> {
  const file = formData.get("csv");
  if (!(file instanceof File) || file.size === 0) {
    return required ? { error: "Envie o arquivo CSV deste lead." } : undefined;
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
  return csv;
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

  const fields = readProductFields(formData);
  if ("error" in fields) return fields;

  const csv = await readCsv(formData, true);
  if (csv && "error" in csv) return csv;
  if (!csv) return { error: "Envie o arquivo CSV deste lead." };

  try {
    await addProduct({ ...fields, csv });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível salvar o lead." };
  }

  redirect("/admin");
}

export async function saveProduct(
  _previous: { error: string },
  formData: FormData,
): Promise<{ error: string }> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!isProductId(id)) return { error: "Lead não encontrado." };

  const fields = readProductFields(formData);
  if ("error" in fields) return fields;

  const csv = await readCsv(formData, false);
  if (csv && "error" in csv) return csv;

  try {
    await updateProduct(id, { ...fields, csv });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível salvar o lead." };
  }

  redirect("/admin");
}

export async function setFeatured(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (isProductId(id)) {
    try {
      await setProductFeatured(id, formData.get("featured") === "1");
    } catch (error) {
      console.error("[admin] destaque", error);
    }
  }
  redirect("/admin");
}

export async function createMenuNiche(
  _previous: { error: string },
  formData: FormData,
): Promise<{ error: string }> {
  await requireAdmin();
  try {
    await addMenuNiche(String(formData.get("name") ?? ""));
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Não foi possível adicionar o submenu." };
  }
  redirect("/admin#submenus");
}

export async function removeMenuNiche(formData: FormData) {
  await requireAdmin();
  const slug = String(formData.get("slug") ?? "");
  try {
    await deleteMenuNiche(slug);
  } catch (error) {
    console.error("[admin] remover submenu", error);
  }
  redirect("/admin#submenus");
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
