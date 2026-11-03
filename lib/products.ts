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
