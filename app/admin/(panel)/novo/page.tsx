import type { Metadata } from "next";
import { createProduct } from "@/app/admin/actions";
import { AdminProductForm } from "@/components/admin-product-form";

export const metadata: Metadata = {
  title: "Adicionar lead",
};

export default function NewProductPage() {
  return (
    <main className="mx-auto max-w-[760px] px-5 py-16">
      <p className="text-[11px] font-medium tracking-[0.22em] text-neon">NOVO LEAD</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-[-0.045em]">Adicionar lead</h1>
      <p className="mt-4 text-sm leading-6 text-mute">
        Se o campo Contatos ficar vazio, a loja usa a quantidade de linhas do CSV, sem o cabeçalho.
      </p>
      <AdminProductForm action={createProduct} submitLabel="Adicionar lead" />
    </main>
  );
}
