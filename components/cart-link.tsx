"use client";

import Link from "next/link";
import { useCart } from "@/components/cart-provider";

export function CartLink() {
  const { count, ready } = useCart();
  const visibleCount = ready ? count : 0;
  const label = visibleCount === 1 ? "Carrinho com 1 item" : `Carrinho com ${visibleCount} itens`;

  return (
    <Link
      href="/carrinho"
      aria-label={visibleCount > 0 ? label : "Carrinho"}
      className="relative inline-flex h-10 w-10 items-center justify-center border border-line text-paper transition-colors hover:border-neon"
    >
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <path
          d="M3.2 5.2h11.6l-.9 7.2a1 1 0 0 1-1 .9H5.1a1 1 0 0 1-1-.9L3.2 5.2Z"
          stroke="currentColor"
          strokeWidth="1.4"
        />
        <path d="M6.2 5.1a2.8 2.8 0 0 1 5.6 0" stroke="currentColor" strokeWidth="1.4" />
      </svg>
      {visibleCount > 0 ? (
        <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center bg-neon px-1 text-[11px] font-semibold tabular-nums text-ink">
          {visibleCount}
        </span>
      ) : null}
    </Link>
  );
}
