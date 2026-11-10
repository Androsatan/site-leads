import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/product-card";
import { listProducts } from "@/lib/catalog";
import { getMenuNiche } from "@/lib/menu-niches";
import { isProductId } from "@/lib/order";
import { nicheSlug, type Product } from "@/lib/products";

export const dynamic = "force-dynamic";

function regionsOf(products: Product[]) {
  const order: string[] = [];
  const groups = new Map<string, Product[]>();

  for (const product of products) {
    const region = product.city.trim() || "Outras";
    const current = groups.get(region);
    if (current) {
      current.push(product);
      continue;
    }
    groups.set(region, [product]);
    order.push(region);
  }

  return order.map((name) => ({ name, products: groups.get(name) ?? [] }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const niche = isProductId(slug) ? await getMenuNiche(slug) : null;
  return {
    title: niche?.name ?? "Nicho",
    description: niche ? `Leads de ${niche.name} em Belo Horizonte, separados por região.` : undefined,
  };
}

export default async function NichePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isProductId(slug)) notFound();

  const niche = await getMenuNiche(slug);
  if (!niche) notFound();

  const products = (await listProducts()).filter((product) => nicheSlug(product.niche) === niche.slug);
  const regions = regionsOf(products);

  return (
    <main className="mx-auto max-w-[1120px] px-5 py-16 md:py-24">
      <p className="text-[11px] font-medium tracking-[0.22em] text-neon">BELO HORIZONTE · MINAS GERAIS</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-[-0.045em] md:text-6xl">{niche.name}</h1>
      <p className="mt-5 max-w-xl text-base leading-7 text-mute">
        Leads de {niche.name.toLowerCase()} separados por região, com WhatsApp validado.
      </p>
      {regions.length === 0 ? (
        <p className="mt-14 border border-line bg-panel/85 px-6 py-16 text-center">Nenhum lead neste nicho ainda.</p>
      ) : (
        <div className="mt-14 space-y-14">
          {regions.map((region) => (
            <section key={region.name}>
              <h2 className="text-[11px] font-medium tracking-[0.22em] text-electric">{region.name.toUpperCase()}</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {region.products.map((product) => (
                  <ProductCard key={product.id} product={product} compact />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      <p className="mt-14">
        <Link href="/listas" className="text-sm text-mute underline underline-offset-2 hover:text-paper">
          Ver todos os leads
        </Link>
      </p>
    </main>
  );
}
