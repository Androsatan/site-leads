"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isAdmin, checkAdminPassword, endAdminSession, startAdminSession, adminPasswordConfigured } from "@/lib/admin-session";
import { clearLoginFailures, loginBlocked, recordLoginFailure } from "@/lib/login-limit";
import { addProduct, removeProduct, setProductFeatured, updateProduct } from "@/lib/catalog";
import { addMenuNiche, listMenuNiches, removeMenuNiche as deleteMenuNiche } from "@/lib/menu-niches";
import { isProductId } from "@/lib/order";
import { nicheSlug } from "@/lib/products";

const CSV_LIMIT = 5 * 1024 * 1024;

async function requireAdmin() {
  if (!(await isAdmin())) redirect("/admin/login");
}

/** O nome gravado é o do submenu, para o lead cair na página daquele nicho. */
async function menuNicheName(name: string): Promise<string | { error: string }> {
  const slug = nicheSlug(name);
  const match = (await listMenuNiches()).find((niche) => niche.slug === slug);
  if (!match) return { error: "Escolha um submenu que exista no menu." };
  return match.name;
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
  whatsappVerified: boolean;
  qualified: boolean;
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
    whatsappVerified: formData.get("whatsappVerified") === "on",
    qualified: formData.get("qualified") === "on",
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

async function clientKey() {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  const real = headerList.get("x-real-ip")?.trim() ?? "";
  return (forwarded || real || "local").slice(0, 80);
}

export async function login(
  _previous: { error: string },
  formData: FormData,
): Promise<{ error: string }> {
  if (!adminPasswordConfigured()) {
    return { error: "Defina ADMIN_PASSWORD no arquivo .env e reinicie o servidor." };
  }

  const key = await clientKey();
  if (loginBlocked(key)) {
    return { error: "Muitas tentativas. Espere alguns minutos." };
  }

  const password = String(formData.get("password") ?? "");
  if (!checkAdminPassword(password)) {
    recordLoginFailure(key);
    await new Promise((resolve) => setTimeout(resolve, 500));
    return { error: "Senha incorreta." };
  }

  clearLoginFailures(key);
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
  const niche = await menuNicheName(fields.niche);
  if (typeof niche !== "string") return niche;

  const csv = await readCsv(formData, true);
  if (csv && "error" in csv) return csv;
  if (!csv) return { error: "Envie o arquivo CSV deste lead." };

  try {
    await addProduct({ ...fields, niche, csv });
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
  const niche = await menuNicheName(fields.niche);
  if (typeof niche !== "string") return niche;

  const csv = await readCsv(formData, false);
  if (csv && "error" in csv) return csv;

  try {
    await updateProduct(id, { ...fields, niche, csv });
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
