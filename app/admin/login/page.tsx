import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AdminLoginForm } from "@/components/admin-login-form";
import { isAdmin } from "@/lib/admin-session";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage() {
  if (await isAdmin()) redirect("/admin");

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-5 py-16">
      <p className="text-[11px] font-medium tracking-[0.22em] text-neon">ADMIN</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-[-0.045em]">Entrar</h1>
      <AdminLoginForm />
    </main>
  );
}
