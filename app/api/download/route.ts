import { NextResponse } from "next/server";
import { buildLeadSample } from "@/lib/csv-sample";
import { readDownloadToken } from "@/lib/download-token";
import { getProduct } from "@/lib/catalog";
import { site } from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function htmlPage(status: number, title: string, message: string) {
  const body = `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title} · ${site.name}</title>
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #07080c; color: #f3f0e8; font-family: Georgia, serif; }
      main { max-width: 28rem; padding: 2rem; }
      p { font-family: Arial, sans-serif; color: #b7b2a8; line-height: 1.6; }
      a { color: #00e887; }
    </style>
  </head>
  <body>
    <main>
      <h1>${title}</h1>
      <p>${message}</p>
      <p><a href="/">Voltar para a LeadSfera</a></p>
    </main>
  </body>
</html>`;

  return new NextResponse(body, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const payload = readDownloadToken(token);

  if (!payload) {
    return htmlPage(
      403,
      "Link inválido",
      "Este endereço de download expirou ou não confere. Use o link mais recente do e-mail de confirmação.",
    );
  }

  const product = await getProduct(payload.pid);
  if (!product) {
    return htmlPage(404, "Lead indisponível", "Não encontramos o lead ligado a este pedido.");
  }

  try {
    const sample = await buildLeadSample({
      fileName: product.fileName,
      requested: payload.n,
      seedKey: `${payload.pay}:${payload.pid}`,
    });
    return new NextResponse(new Uint8Array(sample.csv), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${product.fileName}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[download]", error);
    return htmlPage(
      404,
      "Arquivo indisponível",
      "O arquivo deste lead ainda não está disponível. Fale com o suporte e informe o número do pedido.",
    );
  }
}
