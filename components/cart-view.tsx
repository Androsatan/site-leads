"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { QuantityStepper } from "@/components/quantity-stepper";
import { useCart } from "@/components/cart-provider";
import { requestCheckout } from "@/lib/checkout-client";
import { formatBRL, formatLeads } from "@/lib/format";
import { getProduct } from "@/lib/products";

export function CartView() {
  const cart = useCart();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const errorId = useId();

  const detailed = cart.lines.flatMap((line) => {
    const product = getProduct(line.productId);
    return product ? [{ ...line, product }] : [];
  });
  const total = detailed.reduce((sum, line) => sum + line.product.price * line.quantity, 0);

  async function checkout() {
    setLoading(true);
    setMessage("");

    try {
      const url = await requestCheckout(
        detailed.map((line) => ({ productId: line.productId, quantity: line.quantity })),
      );
      cart.clear();
      window.location.assign(url);
    } catch (error) {
      setLoading(false);
      setMessage(error instanceof Error ? error.message : "Não foi possível abrir o checkout.");
    }
  }

  if (!cart.ready) {
    return <div className="mt-10 min-h-64 border border-line bg-panel/85" />;
  }

  if (detailed.length === 0) {
    return (
      <div className="mt-10 border border-line bg-panel/85 px-6 py-16 text-center">
        <p className="text-lg">Seu carrinho está vazio.</p>
        <Link href="/listas" className="mt-6 inline-flex bg-neon px-5 py-3 text-sm font-semibold text-ink">
          Escolher leads
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-10 grid items-start gap-8 md:grid-cols-[minmax(0,1fr)_300px]">
      <ul className="space-y-4">
        {detailed.map((line) => (
          <li key={line.productId} className="border border-line bg-panel/85 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-medium tracking-[0.18em] text-electric">
                  {line.product.city.toUpperCase()} · {line.product.state}
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">{line.product.name}</h2>
                <p className="mt-2 text-sm text-mute">
                  {formatLeads(line.product.leads)} contatos · {formatBRL(line.product.price)} cada
                </p>
              </div>
              <p className="text-2xl font-semibold tabular-nums">{formatBRL(line.product.price * line.quantity)}</p>
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
              <QuantityStepper
                value={line.quantity}
                disabled={loading}
                onChange={(quantity) => cart.setQuantity(line.productId, quantity)}
              />
              <button
                type="button"
                onClick={() => cart.remove(line.productId)}
                disabled={loading}
                className="cursor-pointer text-sm text-mute underline underline-offset-2 transition-colors hover:text-paper disabled:cursor-not-allowed"
              >
                Remover
              </button>
            </div>
          </li>
        ))}
      </ul>
      <aside className="border border-line bg-panel/85 p-6 md:sticky md:top-24">
        <p className="text-[11px] font-medium tracking-[0.18em] text-mute">TOTAL</p>
        <p className="mt-3 text-5xl font-semibold tabular-nums tracking-[-0.04em]">{formatBRL(total)}</p>
        <p className="mt-2 text-xs tracking-wide text-mute">pagamento único</p>
        <button
          type="button"
          onClick={checkout}
          disabled={loading}
          aria-busy={loading}
          aria-describedby={message ? errorId : undefined}
          className="mt-6 w-full cursor-pointer bg-neon px-4 py-3 text-sm font-semibold text-ink transition-colors hover:bg-white disabled:cursor-progress disabled:opacity-70"
        >
          {loading ? "Abrindo checkout…" : "Ir para o pagamento"}
        </button>
        {message ? (
          <p id={errorId} role="alert" className="mt-3 text-sm leading-5 text-electric">
            {message}
          </p>
        ) : null}
        <Link href="/listas" className="mt-4 block text-center text-sm text-mute underline underline-offset-2">
          Continuar escolhendo leads
        </Link>
      </aside>
    </div>
  );
}
