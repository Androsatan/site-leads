import type { Metadata } from "next";
import Link from "next/link";
import { CheckoutView } from "@/components/checkout-view";
import { listProducts } from "@/lib/catalog";
import { decodeOrder } from "@/lib/order";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pagamento",
  description: "Revise o pedido e informe os dados para gerar o Pix.",
};

function EmptyOrder({ message }: { message: string }) {
  return (
    <div className="mt-10 border border-line bg-panel/85 px-6 py-16 text-center">
      <p className="text-lg">{message}</p>
      <Link href="/listas" className="mt-6 inline-flex bg-neon px-5 py-3 text-sm font-semibold text-ink">
        Escolher leads
      </Link>
    </div>
  );
}

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ pedido?: string | string[]; origem?: string | string[] }>;
}) {
  const params = await searchParams;
  const raw = Array.isArray(params.pedido) ? params.pedido[0] : params.pedido;
  const origin = Array.isArray(params.origem) ? params.origem[0] : params.origem;
  const decoded = raw ? decodeOrder(raw) : null;
  const products = decoded ? await listProducts() : [];
  const byId = new Map(products.map((product) => [product.id, product]));
  const lines =
    decoded?.flatMap((line) => {
      const product = byId.get(line.productId);
      return product ? [{ product, quantity: line.quantity }] : [];
    }) ?? [];

  return (
    <main className="mx-auto max-w-[1120px] px-5 py-16 md:py-24">
      <p className="text-[11px] font-medium tracking-[0.22em] text-neon">PAGAMENTO</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-[-0.045em] md:text-6xl">Finalizar compra</h1>
      {decoded && lines.length === decoded.length ? (
        <CheckoutView lines={lines} backHref={origin === "carrinho" ? "/carrinho" : "/listas"} />
      ) : (
        <EmptyOrder
          message={decoded ? "Um lead desse pedido não está mais disponível." : "Escolha um lead para continuar."}
        />
      )}
    </main>
  );
}
