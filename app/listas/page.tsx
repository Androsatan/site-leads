import type { Metadata } from "next";
import { Catalog } from "@/components/catalog";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Leads Qualificados",
  description:
    "Leads B2B separados pelas 9 regiões de Belo Horizonte, com WhatsApp validado. Pagamento único e CSV no e-mail.",
};

export default function ListasPage() {
  return (
    <main className="mx-auto max-w-[1120px] px-5 py-16 md:py-24">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-[11px] font-medium tracking-[0.22em] text-neon">BELO HORIZONTE · MINAS GERAIS</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.045em] text-balance md:text-6xl">
          Leads Qualificados
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-mute">
          Nichos separados pelas 9 regiões de Belo Horizonte. WhatsApp validado, pagamento único e
          download do CSV no e-mail.
        </p>
      </div>
      <div className="mt-12">
        <Catalog />
      </div>
    </main>
  );
}
