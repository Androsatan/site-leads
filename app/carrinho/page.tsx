import type { Metadata } from "next";
import { CartView } from "@/components/cart-view";

export const metadata: Metadata = {
  title: "Carrinho",
  description: "Revise os leads escolhidos, ajuste a quantidade e siga para o pagamento.",
};

export default function CartPage() {
  return (
    <main className="mx-auto max-w-[1120px] px-5 py-16 md:py-24">
      <p className="text-[11px] font-medium tracking-[0.22em] text-neon">PEDIDO</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-[-0.045em] md:text-6xl">Carrinho</h1>
      <CartView />
    </main>
  );
}
