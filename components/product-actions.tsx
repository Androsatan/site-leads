"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { QuantityStepper } from "@/components/quantity-stepper";
import { useCart } from "@/components/cart-provider";
import { requestCheckout } from "@/lib/checkout-client";
import { formatBRL } from "@/lib/format";

export function ProductActions({
  productId,
  unitPrice,
  className = "",
}: {
  productId: string;
  unitPrice: number;
  className?: string;
}) {
  const cart = useCart();
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [added, setAdded] = useState(false);
  const [message, setMessage] = useState("");
  const errorId = useId();

  async function buy() {
    setLoading(true);
    setMessage("");
    setAdded(false);

    try {
      const url = await requestCheckout([{ productId, quantity }]);
      window.location.assign(url);
    } catch (error) {
      setLoading(false);
      setMessage(error instanceof Error ? error.message : "Não foi possível abrir o checkout.");
    }
  }

  function add() {
    const result = cart.add(productId, quantity);
    setAdded(result === "added");
    setMessage(result === "max" ? "Esse lead já está na quantidade máxima do carrinho." : "");
  }

  return (
    <div className={className}>
      <p className="text-[11px] tracking-[0.16em] text-mute">QUANTIDADE</p>
      <div className="mt-2 flex items-center justify-between gap-3">
        <QuantityStepper value={quantity} onChange={setQuantity} disabled={loading} />
        {quantity > 1 ? (
          <p className="text-right text-sm">
            <span className="block text-[11px] tracking-wide text-mute">Total</span>
            <span className="font-semibold tabular-nums">{formatBRL(unitPrice * quantity)}</span>
          </p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={buy}
        disabled={loading}
        aria-busy={loading}
        aria-describedby={message ? errorId : undefined}
        className="mt-3 w-full cursor-pointer bg-neon px-4 py-3 text-sm font-semibold text-ink transition-colors hover:bg-white disabled:cursor-progress disabled:opacity-70"
      >
        {loading ? "Abrindo checkout…" : "Comprar agora"}
      </button>
      <button
        type="button"
        onClick={add}
        disabled={loading}
        className="mt-2 w-full cursor-pointer border border-line px-4 py-3 text-sm font-semibold text-paper transition-colors hover:border-neon disabled:cursor-not-allowed disabled:opacity-70"
      >
        Adicionar ao carrinho
      </button>
      {added ? (
        <p className="mt-3 text-sm leading-5 text-neon" aria-live="polite">
          Adicionado ao carrinho.{" "}
          <Link href="/carrinho" className="underline underline-offset-2">
            Ver carrinho
          </Link>
        </p>
      ) : null}
      {message ? (
        <p id={errorId} role="alert" className="mt-3 text-sm leading-5 text-electric">
          {message}
        </p>
      ) : null}
    </div>
  );
}
