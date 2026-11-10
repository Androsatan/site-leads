import { NextResponse } from "next/server";
import { MissingEnvError } from "@/lib/env";
import { fetchPixStatus } from "@/lib/paghiper";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TRANSACTION = /^[A-Za-z0-9]{10,32}$/;
const PAID = new Set(["paid", "completed"]);

/** A tela do checkout consulta isto depois de mostrar o QR. Não envia o CSV. */
export async function GET(request: Request) {
  const transactionId = new URL(request.url).searchParams.get("transaction")?.trim() ?? "";
  if (!TRANSACTION.test(transactionId)) {
    return NextResponse.json({ error: "Transação inválida." }, { status: 400 });
  }

  try {
    const status = await fetchPixStatus(transactionId);
    const paid = PAID.has(status.status);
    console.info("[checkout] status consultado", { transactionId, status: status.status, paid });
    return NextResponse.json({ status: paid ? "paid" : status.status || "pending", paid });
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
