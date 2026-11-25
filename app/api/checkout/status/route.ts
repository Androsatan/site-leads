import { NextResponse } from "next/server";
import { MissingEnvError } from "@/lib/env";
import { fetchOrder, isPaidOrder, MP_ORDER_ID } from "@/lib/mercadopago";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A tela do checkout consulta isto depois de mostrar o QR. Não envia o CSV. */
export async function GET(request: Request) {
  const transactionId = new URL(request.url).searchParams.get("transaction")?.trim() ?? "";
  if (!MP_ORDER_ID.test(transactionId)) {
    return NextResponse.json({ error: "Transação inválida." }, { status: 400 });
  }

  try {
    const order = await fetchOrder(transactionId);
    const paid = isPaidOrder(order);
    console.info("[checkout] status consultado", {
      transactionId,
      status: order.status,
      statusDetail: order.statusDetail,
      paid,
    });
    return NextResponse.json({ status: paid ? "paid" : order.status || "pending", paid });
  } catch (error) {
    if (error instanceof MissingEnvError) {
      console.error("[checkout] status sem credencial", { envName: error.envName, transactionId });
      return NextResponse.json({ error: "Não foi possível consultar o pagamento." }, { status: 503 });
    }

    console.error("[checkout] falha ao consultar status", {
      transactionId,
      name: error instanceof Error ? error.name : "unknown",
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Não foi possível consultar o pagamento." }, { status: 502 });
  }
}
