import { Resend } from "resend";
import { DOWNLOAD_TTL_DAYS, createDownloadUrl } from "@/lib/download-token";
import { requireEnv } from "@/lib/env";
import { formatBRL } from "@/lib/format";
import { readProductFile } from "@/lib/product-file";
import type { Product } from "@/lib/products";
import { site } from "@/lib/site";

type DeliveryLine = {
  product: Product;
  quantity: number;
};

type DeliveryInput = {
  to: string;
  buyerName?: string;
  lines: DeliveryLine[];
  paymentId: string;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderDeliveryEmail(input: {
  greeting: string;
  lines: DeliveryLine[];
  paymentId: string;
  downloads: { name: string; url: string }[];
}) {
  const paymentId = escapeHtml(input.paymentId);
  const greeting = escapeHtml(input.greeting);
  const total = input.lines.reduce((sum, line) => sum + line.product.price * line.quantity, 0);
  const price = escapeHtml(formatBRL(total));
  const summary =
    input.lines.length === 1
      ? `os leads de <strong>${escapeHtml(input.lines[0].product.name)}</strong> estão em anexo`
      : "os leads do seu pedido estão em anexo";
  const rows = input.lines
    .map((line) => {
      const name = escapeHtml(line.product.name);
      const linePrice = escapeHtml(formatBRL(line.product.price * line.quantity));
      return `<tr>
                    <td style="padding:14px 0;border-top:1px solid #ece7dc;color:#6d6a62;">${name}<br />${line.quantity} × ${escapeHtml(formatBRL(line.product.price))}</td>
                    <td style="padding:14px 0;border-top:1px solid #ece7dc;text-align:right;vertical-align:top;">${linePrice}</td>
                  </tr>`;
    })
    .join("");
  const buttons = input.downloads
    .map((item) => {
      const name = escapeHtml(item.name);
      const url = escapeHtml(item.url);
      return `<a href="${url}" style="display:inline-block;background:#00e887;color:#07140f;text-decoration:none;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;padding:14px 22px;margin:0 8px 8px 0;">Baixar ${name}</a>`;
    })
    .join("");
  const links = input.downloads
    .map((item) => {
      const url = escapeHtml(item.url);
      return `<a href="${url}" style="color:#161616;word-break:break-all;">${url}</a>`;
    })
    .join("<br />");

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
  <body style="margin:0;padding:0;background:#efece4;color:#161616;font-family:Georgia,'Times New Roman',serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#efece4;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e4dfd4;">
            <tr>
              <td style="padding:28px 32px 8px;font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:0.18em;color:#6d6a62;">
                ${site.name.toUpperCase()}
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 0;font-size:32px;line-height:1.15;">
                Seu CSV chegou.
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#3c3a36;">
                ${greeting} O pagamento foi aprovado e ${summary}. O link abaixo continua válido por ${DOWNLOAD_TTL_DAYS} dias, caso o anexo não abra.
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 0;">
                ${buttons}
              </td>
            </tr>
            <tr>
              <td style="padding:22px 32px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:#6d6a62;">
                Ou copie este endereço:<br />
                ${links}
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px 0;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top:1px solid #ece7dc;font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#161616;">
                  ${rows}
                  <tr>
                    <td style="padding:14px 0;border-top:1px solid #ece7dc;color:#6d6a62;">Total</td>
                    <td style="padding:14px 0;border-top:1px solid #ece7dc;text-align:right;">${price}</td>
                  </tr>
                  <tr>
                    <td style="padding:14px 0;border-top:1px solid #ece7dc;color:#6d6a62;">Pedido</td>
                    <td style="padding:14px 0;border-top:1px solid #ece7dc;text-align:right;">${paymentId}</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 32px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#3c3a36;">
                <strong style="display:block;margin-bottom:8px;color:#161616;">Como usar</strong>
                1. Abra o arquivo no Excel ou em Google Planilhas (Arquivo → Importar).<br />
                2. A primeira linha é o cabeçalho. Filtre por bairro ou categoria antes de prospectar.<br />
                3. Identifique a sua empresa no contato e ofereça um opt-out simples. Isso faz parte da LGPD.
              </td>
            </tr>
          </table>
          <p style="max-width:560px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#6d6a62;">
            Mensagem automática de confirmação de compra. Se você não reconhece este pedido, responda este e-mail.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const textLines = input.lines.map(
    (line) =>
      `- ${line.product.name}: ${line.quantity} × ${formatBRL(line.product.price)} = ${formatBRL(line.product.price * line.quantity)}`,
  );
  const textLinks = input.downloads.map((item) => `${item.name}: ${item.url}`);
  const text = [
    input.greeting,
    "",
    "O pagamento foi aprovado.",
    ...textLines,
    `Total: ${formatBRL(total)}`,
    `Pedido: ${input.paymentId}`,
    "",
    "O CSV vai em anexo. Se ele não abrir, use o link (válido por " + DOWNLOAD_TTL_DAYS + " dias):",
    ...textLinks,
    "",
    "Como usar:",
    "- Abra no Excel ou no Google Planilhas.",
    "- A primeira linha é o cabeçalho.",
    "- Identifique a sua empresa e ofereça opt-out (LGPD).",
  ].join("\n");

  return { html, text };
}

export async function sendDeliveryEmail(input: DeliveryInput) {
  const resend = new Resend(requireEnv("RESEND_API_KEY"));
  const from = requireEnv("RESEND_FROM_EMAIL");
  const downloads = input.lines.map((line) => ({
    name: line.product.name,
    url: createDownloadUrl(line.product.id, input.paymentId),
  }));
  const attachments = await Promise.all(
    input.lines.map(async (line) => ({
      filename: line.product.fileName,
      content: await readProductFile(line.product.fileName),
      contentType: "text/csv" as const,
    })),
  );
  const greeting = input.buyerName ? `Olá, ${input.buyerName}.` : "Olá.";
  const rendered = renderDeliveryEmail({
    greeting,
    lines: input.lines,
    paymentId: input.paymentId,
    downloads,
  });
  const subject =
    input.lines.length === 1
      ? `Seu CSV chegou — ${input.lines[0].product.name}`
      : `Seus CSVs chegaram — ${input.lines.length} leads`;

  const { data, error } = await resend.emails.send(
    {
      from,
      to: input.to,
      subject,
      html: rendered.html,
      text: rendered.text,
      replyTo: process.env.SUPPORT_EMAIL?.trim() || undefined,
      attachments,
    },
    {
      idempotencyKey: `leadsfera-payment-${input.paymentId}`,
    },
  );

  if (error) {
    throw new Error(error.message);
  }

  return data;
}
