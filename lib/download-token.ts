import crypto from "crypto";
import { appUrl, requireEnv } from "@/lib/env";

const TTL_SECONDS = 60 * 60 * 24 * 14;

export const DOWNLOAD_TTL_DAYS = 14;

type DownloadPayload = {
  pid: string;
  pay: string;
  exp: number;
};

export function createDownloadUrl(productId: string, paymentId: string) {
  const secret = requireEnv("DOWNLOAD_TOKEN_SECRET");
  const payload: DownloadPayload = {
    pid: productId,
    pay: paymentId,
    exp: Math.floor(Date.now() / 1000) + TTL_SECONDS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${appUrl()}/api/download?token=${body}.${signature}`;
}

export function readDownloadToken(token: string): DownloadPayload | null {
  const secret = process.env.DOWNLOAD_TOKEN_SECRET?.trim();
  if (!secret) return null;

  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra) return null;

  const expected = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) return null;
  if (!crypto.timingSafeEqual(actualBuffer, expectedBuffer)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Partial<DownloadPayload>;
    if (!payload.pid || !payload.pay || typeof payload.exp !== "number") return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return { pid: payload.pid, pay: payload.pay, exp: payload.exp };
  } catch {
    return null;
  }
}
