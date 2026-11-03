"use client";

import { useState } from "react";
import { MAX_QUANTITY, parseQuantity } from "@/lib/order";

export function QuantityStepper({
  value,
  onChange,
  disabled = false,
}: {
  value: number;
  onChange: (quantity: number) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState(String(value));
  const [source, setSource] = useState(value);

  if (source !== value) {
    setSource(value);
    setDraft(String(value));
  }

  function commit(raw: string) {
    if (/^\d+$/.test(raw) && Number(raw) > MAX_QUANTITY) {
      onChange(MAX_QUANTITY);
      setDraft(String(MAX_QUANTITY));
      return;
    }
    const quantity = parseQuantity(raw) ?? 1;
    onChange(quantity);
    setDraft(String(quantity));
  }

  return (
    <div className="flex h-11 items-center border border-line">
      <button
        type="button"
        aria-label="Diminuir quantidade"
        disabled={disabled || value <= 1}
        onClick={() => onChange(Math.max(1, value - 1))}
        className="h-full w-11 cursor-pointer text-lg leading-none text-paper transition-colors hover:text-neon disabled:cursor-not-allowed disabled:text-mute"
      >
        −
      </button>
      <input
        type="text"
        inputMode="numeric"
        aria-label="Quantidade"
        disabled={disabled}
        value={draft}
        onChange={(event) => {
          const next = event.target.value.replace(/\D/g, "").slice(0, 2);
          if (/^\d+$/.test(next) && Number(next) > MAX_QUANTITY) {
            setDraft(String(MAX_QUANTITY));
            onChange(MAX_QUANTITY);
            return;
          }
          setDraft(next);
          const quantity = parseQuantity(next);
          if (quantity) onChange(quantity);
        }}
        onBlur={() => commit(draft)}
        className="h-full w-12 bg-transparent text-center text-sm tabular-nums outline-none disabled:text-mute"
      />
      <button
        type="button"
        aria-label="Aumentar quantidade"
        disabled={disabled || value >= MAX_QUANTITY}
        onClick={() => onChange(Math.min(MAX_QUANTITY, value + 1))}
        className="h-full w-11 cursor-pointer text-lg leading-none text-paper transition-colors hover:text-neon disabled:cursor-not-allowed disabled:text-mute"
      >
        +
      </button>
    </div>
  );
}
