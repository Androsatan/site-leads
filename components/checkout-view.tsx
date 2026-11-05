"use client";

import { useState } from "react";
import Link from "next/link";
import { PixCheckout } from "@/components/pix-checkout";
import { QuantityStepper } from "@/components/quantity-stepper";
import { formatBRL, formatLeads } from "@/lib/format";
import { encodeOrder } from "@/lib/order";
import type { Product } from "@/lib/products";

export function CheckoutView({
  lines,
  backHref,
}: {
  lines: { product: Product; quantity: number }[];
  backHref: string;
}) {
  const [quantities, setQuantities] = useState(() =>
    Object.fromEntries(lines.map((line) => [line.product.id, line.quantity])),
  );

  function setQuantity(productId: string, quantity: number) {
    const next = { ...quantities, [productId]: quantity };
    setQuantities(next);
    const params = new URLSearchParams(window.location.search);
    params.set(
      "pedido",
      encodeOrder(lines.map((line) => ({ productId: line.product.id, quantity: next[line.product.id] }))),
    );
    window.history.replaceState(null, "", `/checkout?${params.toString()}`);
  }

  const detailed = lines.map((line) => ({
    ...line,
    quantity: quantities[line.product.id] ?? line.quantity,
  }));
  const total = detailed.reduce((sum, line) => sum + line.product.price * line.quantity, 0);

  return (
    <div className="mt-10 grid items-start gap-8 md:grid-cols-[minmax(0,1fr)_340px]">
      <ul className="space-y-4">
        {detailed.map((line) => (
          <li key={line.product.id} className="border border-line bg-panel/85 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-medium tracking-[0.18em] text-electric">
                  {line.product.city.toUpperCase()} · {line.product.state}
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">
                  <Link href={`/listas/${line.product.id}`} className="hover:text-neon">
                    {line.product.name}
                  </Link>
                </h2>
                <p className="mt-2 text-sm text-mute">
                  {formatLeads(line.product.leads)} contatos · {formatBRL(line.product.price)} cada
                </p>
              </div>
              <p className="text-2xl font-semibold tabular-nums">{formatBRL(line.product.price * line.quantity)}</p>
            </div>
            <div className="mt-5">
              <p className="text-[11px] tracking-[0.16em] text-mute">QUANTIDADE</p>
              <div className="mt-2">
                <QuantityStepper value={line.quantity} onChange={(quantity) => setQuantity(line.product.id, quantity)} />
              </div>
            </div>
          </li>
        ))}
      </ul>
      <aside className="border border-line bg-panel/85 p-6 md:sticky md:top-24">
        <p className="text-[11px] font-medium tracking-[0.18em] text-mute">TOTAL</p>
        <p className="mt-3 text-5xl font-semibold tabular-nums tracking-[-0.04em]">{formatBRL(total)}</p>
        <p className="mt-2 text-xs tracking-wide text-mute">pagamento único</p>
        <PixCheckout
          items={detailed.map((line) => ({ productId: line.product.id, quantity: line.quantity }))}
        />
        <Link href={backHref} className="mt-4 block text-center text-sm text-mute underline underline-offset-2">
          Voltar
        </Link>
      </aside>
    </div>
  );
}
