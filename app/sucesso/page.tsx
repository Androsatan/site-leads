import type { Metadata } from "next";
import { StatusScreen } from "@/components/status-screen";

export const metadata: Metadata = {
  title: "Pagamento aprovado",
  robots: { index: false, follow: false },
};

export default function SuccessPage() {
  return (
    <StatusScreen kicker="PAGAMENTO" title="Pagamento aprovado.">
      <p>
        O CSV segue para o e-mail usado no checkout, em anexo, com um link reserva. No cartão isso
        costuma ser imediato. Na primeira compra, olhe também o spam.
      </p>
    </StatusScreen>
  );
}
