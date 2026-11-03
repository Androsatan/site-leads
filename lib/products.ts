/**
 * Catálogo cobrado no checkout. O preço vem sempre daqui, nunca do navegador.
 * O arquivo entregue fica em private/products/{fileName}.
 * As planilhas versionadas são amostras fictícias — troque pelos CSVs reais
 * antes de vender, e não commite leads com dados de clientes.
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

export const products: Product[] = [
  {
    id: "padarias-centro-savassi",
    name: "Padarias — Centro e Savassi",
    niche: "Padarias",
    city: "Centro e Savassi",
    state: "BH",
    leads: 180,
    price: 147,
    fileName: "padarias-centro-savassi.csv",
    featured: true,
    highlight: "Mais pedido",
    fields: ["Nome", "WhatsApp", "Bairro", "Endereço"],
    description:
      "Padarias e confeitarias do hipercentro e da Savassi, com WhatsApp ativo para o primeiro contato comercial.",
  },
  {
    id: "odonto-pampulha",
    name: "Clínicas Odontológicas — Pampulha",
    niche: "Clínicas odontológicas",
    city: "Pampulha",
    state: "BH",
    leads: 220,
    price: 197,
    fileName: "odonto-pampulha.csv",
    fields: ["Nome", "WhatsApp", "Bairro", "Especialidade"],
    description:
      "Consultórios da Pampulha e do São Luiz, filtrados para quem vende para odontologia.",
  },
  {
    id: "imobiliarias-lourdes",
    name: "Imobiliárias — Lourdes",
    niche: "Imobiliárias",
    city: "Lourdes",
    state: "BH",
    leads: 140,
    price: 167,
    fileName: "imobiliarias-lourdes.csv",
    fields: ["Nome", "WhatsApp", "Bairro", "Site"],
    description:
      "Imobiliárias de Lourdes e Santo Antônio, prontas para uma proposta direta no WhatsApp.",
  },
  {
    id: "academias-buritis",
    name: "Academias — Buritis",
    niche: "Academias",
    city: "Buritis",
    state: "BH",
    leads: 160,
    price: 137,
    fileName: "academias-buritis.csv",
    fields: ["Nome", "WhatsApp", "Bairro", "Instagram"],
    description:
      "Academias e estúdios de Buritis e Estoril, com WhatsApp já validado.",
  },
  {
    id: "restaurantes-funcionarios",
    name: "Restaurantes — Funcionários",
    niche: "Restaurantes",
    city: "Funcionários",
    state: "BH",
    leads: 240,
    price: 157,
    fileName: "restaurantes-funcionarios.csv",
    fields: ["Nome", "WhatsApp", "Bairro", "Cozinha"],
    description:
      "Casas de comida de Funcionários e Savassi, separadas por tipo de cozinha.",
  },
  {
    id: "escritorios-serra",
    name: "Escritórios — Serra",
    niche: "Escritórios",
    city: "Serra",
    state: "BH",
    leads: 120,
    price: 187,
    fileName: "escritorios-serra.csv",
    fields: ["Nome", "WhatsApp", "Bairro", "Área"],
    description:
      "Escritórios da Serra e do Belvedere: advocacia, contabilidade e consultoria.",
  },
];

export function getProduct(id: string) {
  return products.find((product) => product.id === id);
}

export function getFeaturedProduct() {
  return products.find((product) => product.featured) ?? products[0];
}

export function productSku(product: Product) {
  return `LS-${product.state}-${product.leads}`;
}
