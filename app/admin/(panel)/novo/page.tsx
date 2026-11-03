import type { Metadata } from "next";
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
        A quantidade de contatos sai das linhas do CSV, sem contar o cabeçalho.
      </p>
      <AdminProductForm />
    </main>
  );
}
