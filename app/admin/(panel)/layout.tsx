import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { logout } from "@/app/admin/actions";
import { isAdmin } from "@/lib/admin-session";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAdmin())) redirect("/admin/login");

  return (
    <div>
      <div className="border-b border-line">
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-4 px-5 py-4">
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/admin" className="font-semibold">
              Leads
            </Link>
            <Link href="/admin/novo" className="text-mute hover:text-paper">
              Adicionar
            </Link>
            <Link href="/" className="text-mute hover:text-paper">
              Ver loja
            </Link>
          </nav>
          <form action={logout}>
            <button type="submit" className="cursor-pointer text-sm text-mute underline underline-offset-2">
              Sair
            </button>
          </form>
        </div>
      </div>
      {children}
    </div>
  );
}
