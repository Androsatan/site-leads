import type { Metadata } from "next";
import Link from "next/link";
import { DeleteProductButton } from "@/components/delete-product-button";
import { listProducts } from "@/lib/catalog";
import { formatBRL, formatLeads } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin",
};

export default async function AdminPage() {
  const products = await listProducts();

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
      <p className="mt-4 max-w-2xl text-sm leading-6 text-mute">
        Incluir ou remover um lead atualiza a loja neste computador. Na Vercel o disco não guarda
        arquivo novo, então esta tela vale para o servidor local.
      </p>
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
              <DeleteProductButton id={product.id} name={product.name} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
