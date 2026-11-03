"use client";

import { useActionState } from "react";
import { login } from "@/app/admin/actions";

export function AdminLoginForm() {
  const [state, action, pending] = useActionState(login, { error: "" });

  return (
    <form action={action} className="mt-8 space-y-4">
      <label className="block text-sm">
        <span className="text-mute">Senha</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-2 w-full border border-line bg-ink px-3 py-3 text-paper outline-none focus:border-neon"
        />
      </label>
      {state.error ? (
        <p role="alert" className="text-sm text-electric">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full cursor-pointer bg-neon px-4 py-3 text-sm font-semibold text-ink disabled:cursor-progress disabled:opacity-70"
      >
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
