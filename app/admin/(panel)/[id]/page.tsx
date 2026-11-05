import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { saveProduct } from "@/app/admin/actions";
import { AdminProductForm } from "@/components/admin-product-form";
import { getProduct } from "@/lib/catalog";
import { isProductId } from "@/lib/order";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Editar lead",
};

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isProductId(id)) notFound();

  const product = await getProduct(id);
  if (!product) notFound();

  return (
    <main className="mx-auto max-w-[760px] px-5 py-16">
      <p className="text-[11px] font-medium tracking-[0.22em] text-neon">EDITAR LEAD</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-[-0.045em]">{product.name}</h1>
      <p className="mt-4 text-sm leading-6 text-mute">
        O endereço do lead na loja permanece o mesmo. A quantidade de contatos só muda se você enviar um CSV novo.
      </p>
      <AdminProductForm action={saveProduct} product={product} submitLabel="Salvar alterações" />
    </main>
  );
}
