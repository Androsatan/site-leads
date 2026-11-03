"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { PixCheckout } from "@/components/pix-checkout";
import { QuantityStepper } from "@/components/quantity-stepper";
import { useCart } from "@/components/cart-provider";
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
  const [paying, setPaying] = useState(false);
  const [added, setAdded] = useState(false);
  const [message, setMessage] = useState("");
  const errorId = useId();

  function add() {
    const result = cart.add(productId, quantity);
    setAdded(result === "added");
    setMessage(result === "max" ? "Esse lead já está na quantidade máxima do carrinho." : "");
  }

  return (
    <div className={className}>
      <p className="text-[11px] tracking-[0.16em] text-mute">QUANTIDADE</p>
      <div className="mt-2 flex items-center justify-between gap-3">
        <QuantityStepper value={quantity} onChange={setQuantity} disabled={paying} />
        {quantity > 1 ? (
          <p className="text-right text-sm">
            <span className="block text-[11px] tracking-wide text-mute">Total</span>
            <span className="font-semibold tabular-nums">{formatBRL(unitPrice * quantity)}</span>
          </p>
        ) : null}
      </div>
      {paying ? (
        <PixCheckout items={[{ productId, quantity }]} onClose={() => setPaying(false)} />
      ) : (
        <>
          <button
            type="button"
            onClick={() => {
              setMessage("");
              setAdded(false);
              setPaying(true);
            }}
            aria-describedby={message ? errorId : undefined}
            className="mt-3 w-full cursor-pointer bg-neon px-4 py-3 text-sm font-semibold text-ink transition-colors hover:bg-white"
          >
            Comprar agora
          </button>
          <button
            type="button"
            onClick={add}
            className="mt-2 w-full cursor-pointer border border-line px-4 py-3 text-sm font-semibold text-paper transition-colors hover:border-neon"
          >
            Adicionar ao carrinho
          </button>
        </>
      )}
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
