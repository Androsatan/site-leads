"use client";

import { useActionState } from "react";
import { createMenuNiche, removeMenuNiche } from "@/app/admin/actions";

const fieldClass = "mt-2 w-full border border-line bg-ink px-3 py-3 text-sm text-paper outline-none focus:border-neon sm:w-72";

export function AdminNicheForm() {
  const [state, formAction, pending] = useActionState(createMenuNiche, { error: "" });

  return (
    <form action={formAction} className="mt-4 flex flex-wrap items-end gap-3">
      <label className="block text-sm">
        <span className="text-mute">Nome do nicho</span>
        <input name="name" required minLength={2} maxLength={60} placeholder="Padarias" className={fieldClass} />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="cursor-pointer bg-neon px-4 py-3 text-sm font-semibold text-ink disabled:cursor-progress disabled:opacity-70"
      >
        {pending ? "Adicionando…" : "Adicionar submenu"}
      </button>
      {state.error ? (
        <p role="alert" className="w-full text-sm text-electric">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

export function RemoveNicheButton({ slug, name }: { slug: string; name: string }) {
  return (
    <form action={removeMenuNiche}>
      <input type="hidden" name="slug" value={slug} />
      <button
        type="submit"
        className="cursor-pointer text-sm text-mute underline underline-offset-2 hover:text-paper"
        onClick={(event) => {
          if (!window.confirm(`Remover o submenu "${name}"? Os leads desse nicho continuam na loja.`)) {
            event.preventDefault();
          }
        }}
      >
        Remover
      </button>
    </form>
  );
}
