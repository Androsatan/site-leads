import type { Metadata } from "next";
import { createProduct } from "@/app/admin/actions";
import { AdminProductForm } from "@/components/admin-product-form";
import { listMenuNiches } from "@/lib/menu-niches";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Adicionar lead",
};

export default async function NewProductPage() {
  const niches = await listMenuNiches();

  return (
    <main className="mx-auto max-w-[760px] px-5 py-16">
      <p className="text-[11px] font-medium tracking-[0.22em] text-neon">NOVO LEAD</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-[-0.045em]">Adicionar lead</h1>
      <p className="mt-4 text-sm leading-6 text-mute">
        Se o campo Contatos ficar vazio, a loja usa a quantidade de linhas do CSV, sem o cabeçalho.
      </p>
      <AdminProductForm action={createProduct} niches={niches} submitLabel="Adicionar lead" />
    </main>
  );
}
