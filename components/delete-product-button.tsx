"use client";

import { deleteProduct } from "@/app/admin/actions";

export function DeleteProductButton({ id, name }: { id: string; name: string }) {
  return (
    <form action={deleteProduct}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="cursor-pointer text-sm text-mute underline underline-offset-2 hover:text-paper"
        onClick={(event) => {
          if (!window.confirm(`Remover "${name}" da loja?`)) event.preventDefault();
        }}
      >
        Remover
      </button>
    </form>
  );
}
