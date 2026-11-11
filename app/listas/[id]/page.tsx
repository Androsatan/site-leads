import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LeadBadges } from "@/components/product-card";
import { ProductActions } from "@/components/product-actions";
import { getProduct } from "@/lib/catalog";
import { formatBRL, formatLeads } from "@/lib/format";
import { isProductId } from "@/lib/order";
import { productSku } from "@/lib/products";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const product = isProductId(id) ? await getProduct(id) : undefined;
  return {
    title: product?.name ?? "Lead",
    description: product?.description,
  };
}

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isProductId(id)) notFound();

  const product = await getProduct(id);
  if (!product) notFound();

  return (
    <main className="mx-auto max-w-[1120px] px-5 py-16 md:py-24">
      <p className="text-[11px] font-medium tracking-[0.22em] text-neon">
        {product.niche.toUpperCase()} · {product.city.toUpperCase()} · {product.state}
      </p>
      <div className="mt-10 grid items-start gap-8 md:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            {product.highlight ? (
              <span className="bg-neon px-2 py-1 text-[11px] font-semibold text-ink">{product.highlight}</span>
            ) : (
              <span className="font-mono text-[11px] tracking-[0.12em] text-mute">{productSku(product)}</span>
            )}
            <LeadBadges product={product} />
          </div>
          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.045em] md:text-6xl">{product.name}</h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-mute">{product.description}</p>
          <h2 className="mt-10 text-[11px] font-medium tracking-[0.18em] text-electric">O QUE VEM NO CSV</h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {product.fields.map((field) => (
              <li key={field} className="border border-line px-3 py-2 text-sm">
                {field}
              </li>
            ))}
          </ul>
          <p className="mt-8 text-sm text-mute">
            {formatLeads(product.leads)} contatos
            {product.whatsappVerified ? " com WhatsApp validado" : ""}. Pagamento único e o arquivo chega no e-mail.
          </p>
          <Link href="/listas" className="mt-8 inline-block text-sm text-mute underline underline-offset-2">
            Ver todos leads
          </Link>
        </div>
        <aside className="border border-line bg-panel/85 p-6 md:sticky md:top-24">
          <p className="text-sm text-mute">{formatLeads(product.leads)} contatos</p>
          <p className="mt-1 text-5xl font-semibold tabular-nums tracking-[-0.04em]">{formatBRL(product.price)}</p>
          <p className="mt-2 text-xs tracking-wide text-mute">pagamento único</p>
          <ProductActions productId={product.id} unitPrice={product.price} className="mt-6" />
        </aside>
      </div>
    </main>
  );
}
