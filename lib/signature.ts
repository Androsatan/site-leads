import crypto from "crypto";

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

/**
 * Conferência do header x-signature dos webhooks do Mercado Pago.
 * Manifesto: id:{data.id};request-id:{x-request-id};ts:{ts};
 */
export function verifyMercadoPagoSignature(
  headers: Headers,
  dataId: string,
  secret: string,
) {
  const xSignature = headers.get("x-signature");
  const xRequestId = headers.get("x-request-id");
  if (!xSignature || !xRequestId || !dataId) return false;

  const parts = new Map<string, string>();
  for (const chunk of xSignature.split(",")) {
    const index = chunk.indexOf("=");
    if (index === -1) continue;
    parts.set(chunk.slice(0, index).trim(), chunk.slice(index + 1).trim());
  }

  const ts = parts.get("ts");
  const v1 = parts.get("v1");
  if (!ts || !v1) return false;

  const id = /[a-z]/i.test(dataId) ? dataId.toLowerCase() : dataId;
  const manifest = `id:${id};request-id:${xRequestId};ts:${ts};`;
  const expected = crypto.createHmac("sha256", secret).update(manifest).digest("hex");

  return safeEqual(expected, v1.toLowerCase());
}
