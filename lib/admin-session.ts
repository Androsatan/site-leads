import { createHash, createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { requireEnv } from "@/lib/env";

const COOKIE = "leadsfera_admin";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function passwordsMatch(input: string, expected: string) {
  const left = createHash("sha256").update(input).digest();
  const right = createHash("sha256").update(expected).digest();
  return timingSafeEqual(left, right);
}

export function adminPasswordConfigured() {
  return Boolean(process.env.ADMIN_PASSWORD?.trim());
}

export function checkAdminPassword(password: string) {
  const expected = process.env.ADMIN_PASSWORD?.trim();
  if (!expected || !password) return false;
  return passwordsMatch(password, expected);
}

function sign(exp: number) {
  const body = Buffer.from(JSON.stringify({ exp })).toString("base64url");
  const signature = createHmac("sha256", requireEnv("DOWNLOAD_TOKEN_SECRET")).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function readToken(token: string) {
  const secret = process.env.DOWNLOAD_TOKEN_SECRET?.trim();
  if (!secret) return null;

  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra) return null;

  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) return null;
  if (!timingSafeEqual(actualBuffer, expectedBuffer)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as { exp?: unknown };
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function isAdmin() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return false;
  return readToken(token) !== null;
}

export async function startAdminSession() {
  const jar = await cookies();
  jar.set(COOKIE, sign(Date.now() + MAX_AGE_SECONDS * 1000), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function endAdminSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}
