"use client";

import { useId, useState } from "react";
import { requestCheckout, type PixPayment } from "@/lib/checkout-client";
import type { OrderLine } from "@/lib/order";

const fieldClass = "mt-2 w-full border border-line bg-ink px-3 py-3 text-sm text-paper outline-none focus:border-neon";

export function PixCheckout({
  items,
  onClose,
  onReady,
}: {
  items: OrderLine[];
  onClose?: () => void;
  onReady?: () => void;
}) {
  const [payer, setPayer] = useState({ name: "", email: "", cpfCnpj: "" });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [payment, setPayment] = useState<PixPayment | null>(null);
  const [copied, setCopied] = useState(false);
  const errorId = useId();
  const orderKey = items.map((item) => `${item.productId}:${item.quantity}`).join(",");
  const [seenOrder, setSeenOrder] = useState(orderKey);

  if (seenOrder !== orderKey) {
    setSeenOrder(orderKey);
    setPayment(null);
    setCopied(false);
  }

  async function pay() {
    setLoading(true);
    setMessage("");

    try {
      const result = await requestCheckout(items, payer);
      setPayment(result);
      onReady?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível gerar o Pix.");
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!payment) return;
    try {
      await navigator.clipboard.writeText(payment.pixCode);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  if (payment) {
    return (
      <div className="mt-4 border border-line bg-ink p-4">
        <p className="text-[11px] tracking-[0.16em] text-neon">PIX</p>
        <p className="mt-2 text-sm leading-6 text-mute">
          Pague com o QR Code ou com o código. O CSV chega no e-mail quando o pagamento for confirmado.
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={payment.qrcodeImageUrl}
          alt="QR Code do Pix"
          className="mx-auto mt-4 h-52 w-52 bg-white p-2"
        />
        <textarea
          readOnly
          value={payment.pixCode}
          aria-label="Código Pix copia e cola"
          className="mt-4 h-24 w-full resize-none border border-line bg-panel px-3 py-2 text-xs leading-5 text-paper"
        />
        <button
          type="button"
          onClick={copy}
          className="mt-3 w-full cursor-pointer bg-neon px-4 py-3 text-sm font-semibold text-ink"
        >
          {copied ? "Código copiado" : "Copiar código Pix"}
        </button>
      </div>
    );
  }

  return (
    <form
      className="mt-4 space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        void pay();
      }}
    >
      <label className="block text-sm">
        <span className="text-mute">Nome completo</span>
        <input
          required
          name="name"
          autoComplete="name"
          value={payer.name}
          onChange={(event) => setPayer((current) => ({ ...current, name: event.target.value }))}
          className={fieldClass}
        />
      </label>
      <label className="block text-sm">
        <span className="text-mute">E-mail</span>
        <input
          required
          type="email"
          name="email"
          autoComplete="email"
          value={payer.email}
          onChange={(event) => setPayer((current) => ({ ...current, email: event.target.value }))}
          className={fieldClass}
        />
      </label>
      <label className="block text-sm">
        <span className="text-mute">CPF ou CNPJ</span>
        <input
          required
          name="cpf"
          inputMode="numeric"
          autoComplete="off"
          value={payer.cpfCnpj}
          onChange={(event) => setPayer((current) => ({ ...current, cpfCnpj: event.target.value }))}
          className={fieldClass}
        />
      </label>
      {message ? (
        <p id={errorId} role="alert" className="text-sm leading-5 text-electric">
          {message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={loading}
        aria-describedby={message ? errorId : undefined}
        className="w-full cursor-pointer bg-neon px-4 py-3 text-sm font-semibold text-ink disabled:cursor-progress disabled:opacity-70"
      >
        {loading ? "Gerando Pix…" : "Gerar Pix"}
      </button>
      {onClose ? (
        <button type="button" onClick={onClose} className="w-full cursor-pointer text-sm text-mute underline underline-offset-2">
          Cancelar
        </button>
      ) : null}
    </form>
  );
}
