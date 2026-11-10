/**
 * Formato do catálogo. Os produtos em si ficam em private/catalog.json
 * e são lidos no servidor por lib/catalog.ts.
 * O preço cobrado sai sempre desse arquivo, nunca do navegador.
 */

export type Product = {
  id: string;
  name: string;
  niche: string;
  city: string;
  state: string;
  leads: number;
  /** Preço em reais, inteiro. */
  price: number;
  fileName: string;
  fields: string[];
  description: string;
  featured?: boolean;
  highlight?: string;
};

export function productSku(product: Product) {
  return `LS-${product.state}-${product.leads}`;
}

export function nicheSlug(niche: string) {
  return niche
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/** Nichos na ordem em que aparecem no catálogo. */
export function listNiches(products: Product[]) {
  const seen = new Set<string>();
  const niches: { name: string; slug: string }[] = [];

  for (const product of products) {
    const name = product.niche.trim();
    const slug = nicheSlug(name);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    niches.push({ name, slug });
  }

  return niches;
}
