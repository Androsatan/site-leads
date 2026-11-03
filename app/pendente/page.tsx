import type { Metadata } from "next";
import { StatusScreen } from "@/components/status-screen";

export const metadata: Metadata = {
  title: "Pagamento em análise",
  robots: { index: false, follow: false },
};

export default function PendingPage() {
  return (
    <StatusScreen kicker="PAGAMENTO" title="Pagamento em análise.">
      <p>
        Pix e boleto podem levar um pouco para compensar. Pode fechar esta página: o e-mail sai
        sozinho quando o pagamento for aprovado.
      </p>
    </StatusScreen>
  );
}
