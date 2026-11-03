import type { Metadata } from "next";
import { StatusScreen } from "@/components/status-screen";

export const metadata: Metadata = {
  title: "Pagamento não concluído",
  robots: { index: false, follow: false },
};

export default function FailurePage() {
  return (
    <StatusScreen kicker="PAGAMENTO" title="Pagamento não concluído.">
      <p>
        Nada foi confirmado. Escolha o lead de novo e tente outro meio — Pix costuma passar
        quando o cartão recusa.
      </p>
    </StatusScreen>
  );
}
