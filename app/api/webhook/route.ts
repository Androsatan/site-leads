import { NextResponse } from "next/server";
import { fulfillPaidOrder } from "@/lib/fulfillment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * O gateway avisa esta rota quando o Pix muda de estado.
 * O CSV só sai depois do pagamento confirmado na API do gateway.
 * A página /sucesso não envia arquivo.
 */
export async function POST(request: Request) {
  const raw = await request.text();

  // TODO: Asaas ou PagHiper
  // 1. Validar a assinatura do webhook com o segredo do .env.
  // 2. Ler o id da cobrança no corpo.
  // 3. Consultar a cobrança na API e seguir só se o Pix estiver pago.
  // 4. Chamar fulfillPaidOrder({ paymentId, email, buyerName, reference }).
  void raw;
  void fulfillPaidOrder;

  return NextResponse.json({ received: true });
}

export function GET() {
  return NextResponse.json({ ok: true });
}
