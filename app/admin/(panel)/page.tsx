import type { Metadata } from "next";
import Link from "next/link";
import { setFeatured } from "@/app/admin/actions";
import { AdminNicheForm, RemoveNicheButton } from "@/components/admin-niches";
import { DeleteProductButton } from "@/components/delete-product-button";
import { listProducts } from "@/lib/catalog";
import { formatBRL, formatLeads } from "@/lib/format";
import { listMenuNiches } from "@/lib/menu-niches";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin",
};

export default async function AdminPage() {
  const [products, niches] = await Promise.all([listProducts(), listMenuNiches()]);

  return (
    <main className="mx-auto max-w-[1120px] px-5 py-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium tracking-[0.22em] text-neon">CATÁLOGO</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-[-0.045em]">Leads da loja</h1>
        </div>
        <Link href="/admin/novo" className="bg-neon px-4 py-3 text-sm font-semibold text-ink">
          Adicionar lead
        </Link>
      </div>
      {products.length === 0 ? (
        <p className="mt-10 border border-line bg-panel/85 px-6 py-12 text-center">Nenhum lead no catálogo.</p>
      ) : (
        <ul className="mt-10 divide-y divide-line border border-line bg-panel/85">
          {products.map((product) => (
            <li key={product.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
              <div>
                <p className="font-semibold">{product.name}</p>
                <p className="mt-1 text-sm text-mute">
                  {formatLeads(product.leads)} contatos · {formatBRL(product.price)}
                  {product.featured ? " · destaque" : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <Link href={`/admin/${product.id}`} className="text-sm font-semibold text-neon">
                  Editar
                </Link>
                <form action={setFeatured}>
                  <input type="hidden" name="id" value={product.id} />
                  <input type="hidden" name="featured" value={product.featured ? "0" : "1"} />
                  <button
                    type="submit"
                    className="cursor-pointer text-sm text-paper underline underline-offset-2"
                  >
                    {product.featured ? "Tirar destaque" : "Destacar"}
                  </button>
                </form>
                <DeleteProductButton id={product.id} name={product.name} />
              </div>
            </li>
          ))}
        </ul>
      )}
      <section id="submenus" className="mt-16 scroll-mt-24 border border-line bg-panel/85 px-5 py-6">
        <h2 className="text-2xl font-semibold tracking-[-0.03em]">Submenus de Leads</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-mute">
          Estes nomes aparecem ao passar o mouse em Leads. Remover tira o submenu. Os leads desse nicho
          continuam na loja e voltam ao menu se o mesmo nome for adicionado de novo.
        </p>
        <AdminNicheForm />
        {niches.length === 0 ? (
          <p className="mt-6 text-sm text-mute">Nenhum submenu no menu.</p>
        ) : (
          <ul className="mt-6 divide-y divide-line border border-line">
            {niches.map((niche) => (
              <li key={niche.slug} className="flex items-center justify-between gap-4 px-4 py-3">
                <div>
                  <p className="font-semibold">{niche.name}</p>
                  <p className="mt-1 text-sm text-mute">/nichos/{niche.slug}</p>
                </div>
                <RemoveNicheButton slug={niche.slug} name={niche.name} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
