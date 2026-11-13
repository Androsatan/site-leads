import type { Metadata } from "next";
import { formatBRL, formatCents, formatLeads } from "@/lib/format";
import { listPurchases, type Purchase, type PurchaseDelivery } from "@/lib/purchases";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Compras",
};

const deliveryLabel: Record<PurchaseDelivery, string> = {
  enviado: "CSV enviado",
  pendente: "CSV pendente",
  falhou: "CSV não enviado",
};

function paymentLabel(purchase: Purchase) {
  if (purchase.payment === "aguardando") return "Aguardando pagamento";
  return "Pago";
}

function formatWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  });
}

export default async function PurchasesPage() {
  const purchases = await listPurchases();
  const paid = purchases.filter((purchase) => purchase.payment === "pago");
  const waiting = purchases.length - paid.length;
  const customers = new Set(purchases.map((purchase) => purchase.email).filter(Boolean)).size;
  const received = paid.reduce((sum, purchase) => sum + purchase.totalCents, 0);

  return (
    <main className="mx-auto max-w-[1120px] px-5 py-16">
      <p className="text-[11px] font-medium tracking-[0.22em] text-neon">COMPRAS</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-[-0.045em]">Histórico</h1>

      <dl className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="border border-line bg-panel/85 px-5 py-4">
          <dt className="text-[11px] font-medium tracking-[0.16em] text-mute">PAGAS</dt>
          <dd className="mt-2 text-3xl font-semibold tabular-nums">{paid.length}</dd>
        </div>
        <div className="border border-line bg-panel/85 px-5 py-4">
          <dt className="text-[11px] font-medium tracking-[0.16em] text-mute">AGUARDANDO</dt>
          <dd className="mt-2 text-3xl font-semibold tabular-nums">{waiting}</dd>
        </div>
        <div className="border border-line bg-panel/85 px-5 py-4">
          <dt className="text-[11px] font-medium tracking-[0.16em] text-mute">CLIENTES</dt>
          <dd className="mt-2 text-3xl font-semibold tabular-nums">{customers}</dd>
        </div>
        <div className="border border-line bg-panel/85 px-5 py-4">
          <dt className="text-[11px] font-medium tracking-[0.16em] text-mute">RECEBIDO</dt>
          <dd className="mt-2 text-3xl font-semibold tabular-nums">{formatCents(received)}</dd>
        </div>
      </dl>

      {purchases.length === 0 ? (
        <p className="mt-10 border border-line bg-panel/85 px-6 py-12 text-center">
          Nenhuma compra ainda.
        </p>
      ) : (
        <ul className="mt-10 divide-y divide-line border border-line bg-panel/85">
          {purchases.map((purchase) => (
            <li key={purchase.transactionId} className="grid gap-4 px-5 py-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
              <div>
                <p className="font-semibold">{purchase.buyerName || "Nome não informado"}</p>
                <p className="mt-1 text-sm text-mute">{purchase.email || "E-mail não informado"}</p>
                <p className="mt-2 text-sm text-mute">
                  {formatWhen(purchase.paidAt ?? purchase.createdAt)} · Pix ·{" "}
                  <span className={purchase.payment === "aguardando" ? "text-electric" : "text-paper"}>
                    {paymentLabel(purchase)}
                  </span>
                  {purchase.payment === "pago" ? (
                    <>
                      {" "}
                      ·{" "}
                      <span className={purchase.delivery === "falhou" ? "text-electric" : "text-paper"}>
                        {deliveryLabel[purchase.delivery]}
                      </span>
                    </>
                  ) : null}
                </p>
                <ul className="mt-3 space-y-1 text-sm">
                  {purchase.items.length === 0 ? (
                    <li className="text-mute">Itens não identificados.</li>
                  ) : (
                    purchase.items.map((item) => (
                      <li key={item.productId}>
                        {item.quantity}× {item.name}
                        <span className="text-mute">
                          {" "}
                          · {formatLeads(item.contacts)} contatos · {formatBRL(item.unitPrice)} cada
                        </span>
                      </li>
                    ))
                  )}
                </ul>
                <p className="mt-3 font-mono text-[11px] tracking-wide text-mute">{purchase.transactionId}</p>
              </div>
              <p className="text-2xl font-semibold tabular-nums md:text-right">{formatCents(purchase.totalCents)}</p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
