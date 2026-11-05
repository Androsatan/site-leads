import type { Metadata } from "next";
import Link from "next/link";
import { setFeatured } from "@/app/admin/actions";
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
        Incluir, editar ou destacar um lead atualiza a loja neste computador. Na Vercel o disco não
        guarda arquivo novo, então esta tela vale para o servidor local.
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
    </main>
  );
}
