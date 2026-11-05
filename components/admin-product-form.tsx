"use client";

import { useActionState } from "react";
import type { Product } from "@/lib/products";

const fieldClass = "mt-2 w-full border border-line bg-ink px-3 py-3 text-paper outline-none focus:border-neon";

export function AdminProductForm({
  action,
  product,
  submitLabel,
}: {
  action: (previous: { error: string }, formData: FormData) => Promise<{ error: string }>;
  product?: Product;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, { error: "" });

  return (
    <form action={formAction} className="mt-10 grid gap-5 md:grid-cols-2">
      {product ? <input type="hidden" name="id" value={product.id} /> : null}
      <label className="block text-sm">
        <span className="text-mute">Nome</span>
        <input
          name="name"
          required
          maxLength={80}
          defaultValue={product?.name}
          className={fieldClass}
          placeholder="Padarias — Centro e Savassi"
        />
      </label>
      <label className="block text-sm">
        <span className="text-mute">Nicho</span>
        <input
          name="niche"
          required
          maxLength={60}
          defaultValue={product?.niche}
          className={fieldClass}
          placeholder="Padarias"
        />
      </label>
      <label className="block text-sm">
        <span className="text-mute">Cidade ou bairro</span>
        <input
          name="city"
          required
          maxLength={60}
          defaultValue={product?.city}
          className={fieldClass}
          placeholder="Savassi"
        />
      </label>
      <label className="block text-sm">
        <span className="text-mute">Estado</span>
        <input name="state" required maxLength={8} defaultValue={product?.state ?? "BH"} className={fieldClass} />
      </label>
      <label className="block text-sm">
        <span className="text-mute">Preço em reais</span>
        <input
          name="price"
          type="number"
          required
          min={1}
          max={100000}
          step={1}
          defaultValue={product?.price}
          className={fieldClass}
          placeholder="147"
        />
      </label>
      <label className="block text-sm">
        <span className="text-mute">Selo, se houver</span>
        <input
          name="highlight"
          maxLength={24}
          defaultValue={product?.highlight}
          className={fieldClass}
          placeholder="Mais pedido"
        />
      </label>
      <label className="block text-sm md:col-span-2">
        <span className="text-mute">Descrição</span>
        <textarea
          name="description"
          required
          maxLength={400}
          rows={4}
          defaultValue={product?.description}
          className={fieldClass}
        />
      </label>
      <label className="block text-sm md:col-span-2">
        <span className="text-mute">Colunas do CSV, separadas por vírgula</span>
        <input
          name="fields"
          required
          defaultValue={product ? product.fields.join(", ") : "Nome, WhatsApp, Bairro"}
          className={fieldClass}
        />
      </label>
      <label className="block text-sm md:col-span-2">
        <span className="text-mute">{product ? "Substituir o CSV, se quiser" : "Arquivo CSV"}</span>
        <input
          name="csv"
          type="file"
          required={!product}
          accept=".csv,text/csv"
          className="mt-2 block w-full text-sm text-mute file:mr-4 file:border-0 file:bg-neon file:px-4 file:py-2 file:text-sm file:font-semibold file:text-ink"
        />
        {product ? (
          <span className="mt-2 block text-xs text-mute">
            Arquivo atual: {product.fileName}. Sem um arquivo novo, os contatos continuam os mesmos.
          </span>
        ) : null}
      </label>
      <label className="flex items-center gap-3 text-sm md:col-span-2">
        <input name="featured" type="checkbox" defaultChecked={Boolean(product?.featured)} className="size-4 accent-neon" />
        Mostrar em destaque na página inicial
      </label>
      {state.error ? (
        <p role="alert" className="text-sm text-electric md:col-span-2">
          {state.error}
        </p>
      ) : null}
      <div className="md:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="cursor-pointer bg-neon px-5 py-3 text-sm font-semibold text-ink disabled:cursor-progress disabled:opacity-70"
        >
          {pending ? "Salvando…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
