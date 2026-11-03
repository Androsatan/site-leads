"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";
import { MAX_QUANTITY, isProductId, parseQuantity, type OrderLine } from "@/lib/order";

const STORAGE_KEY = "leadsfera-cart";

let memory = "[]";

function readRaw() {
  if (typeof window === "undefined") return "[]";
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) memory = stored;
  } catch {
    // Continua com a última cópia da sessão.
  }
  return memory;
}

function writeRaw(value: string) {
  memory = value;
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Carrinho fica só na memória desta aba.
  }
  window.dispatchEvent(new Event("leadsfera-cart"));
}

function subscribe(onStoreChange: () => void) {
  window.addEventListener("leadsfera-cart", onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener("leadsfera-cart", onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function parse(raw: string): OrderLine[] {
  try {
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];

    const lines: OrderLine[] = [];
    for (const item of data) {
      if (!item || typeof item !== "object") continue;
      const productId = "productId" in item && typeof item.productId === "string" ? item.productId : "";
      const quantity = "quantity" in item ? parseQuantity(item.quantity) : null;
      if (!isProductId(productId) || !quantity) continue;
      lines.push({ productId, quantity });
    }
    return lines;
  } catch {
    return [];
  }
}

type CartContextValue = {
  lines: OrderLine[];
  count: number;
  ready: boolean;
  add: (productId: string, quantity: number) => "added" | "max";
  setQuantity: (productId: string, quantity: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const raw = useSyncExternalStore(subscribe, readRaw, () => "[]");
  const ready = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const lines = useMemo(() => parse(raw), [raw]);
  const count = lines.reduce((total, line) => total + line.quantity, 0);

  const commit = useCallback((next: OrderLine[]) => {
    writeRaw(JSON.stringify(next));
  }, []);

  const add = useCallback(
    (productId: string, quantity: number) => {
      const qty = parseQuantity(quantity);
      const current = parse(readRaw());
      const existing = current.find((line) => line.productId === productId);
      if (!qty) return "max" as const;

      const merged = Math.min(MAX_QUANTITY, (existing?.quantity ?? 0) + qty);
      if (existing && merged === existing.quantity) return "max" as const;

      const next = existing
        ? current.map((line) => (line.productId === productId ? { productId, quantity: merged } : line))
        : [...current, { productId, quantity: merged }];
      commit(next);
      return "added" as const;
    },
    [commit],
  );

  const setQuantity = useCallback(
    (productId: string, quantity: number) => {
      const qty = parseQuantity(quantity);
      if (!qty) return;
      const current = parse(readRaw());
      commit(current.map((line) => (line.productId === productId ? { productId, quantity: qty } : line)));
    },
    [commit],
  );

  const remove = useCallback(
    (productId: string) => {
      commit(parse(readRaw()).filter((line) => line.productId !== productId));
    },
    [commit],
  );

  const clear = useCallback(() => {
    commit([]);
  }, [commit]);

  const value = useMemo(
    () => ({ lines, count, ready, add, setQuantity, remove, clear }),
    [lines, count, ready, add, setQuantity, remove, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const cart = useContext(CartContext);
  if (!cart) throw new Error("useCart precisa do CartProvider");
  return cart;
}
