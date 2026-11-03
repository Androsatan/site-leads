import type { OrderLine } from "@/lib/order";

export async function requestCheckout(items: OrderLine[]) {
  const response = await fetch("/api/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
  const data = (await response.json()) as { url?: string; error?: string };

  if (!response.ok || !data.url) {
    throw new Error(data.error || "Não foi possível abrir o checkout.");
  }

  return data.url;
}
