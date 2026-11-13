/** Sessão do admin. Só Web Crypto, para o middleware e o servidor usarem a mesma regra. */

export const ADMIN_MAX_AGE_SECONDS = 60 * 60 * 12;

const PURPOSE = "leadsfera-admin.v1";

export function adminCookieName(secure: boolean) {
  return secure ? "__Host-leadsfera_admin" : "leadsfera_admin";
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlToBytes(value: string) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function sameString(left: string, right: string) {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Marca da senha atual. O cookie deixa de valer quando a senha muda. */
export async function passwordMark(password: string) {
  return (await sha256Hex(password)).slice(0, 16);
}

/** Rede e navegador de quem entrou. Outro computador não reaproveita o cookie. */
export function sessionBinding(forwardedFor: string | null, realIp: string | null, userAgent: string | null) {
  const forwarded = (forwardedFor ?? "").split(",")[0]?.trim() ?? "";
  const ip = (forwarded || (realIp ?? "").trim() || "local").slice(0, 64);
  const agent = (userAgent ?? "").trim().slice(0, 180);
  return `${ip}\n${agent}`;
}

async function hmac(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return bytesToBase64Url(new Uint8Array(signature));
}

export async function createAdminToken(secret: string, password: string, binding: string, now = Date.now()) {
  const body = bytesToBase64Url(
    new TextEncoder().encode(
      JSON.stringify({
        exp: now + ADMIN_MAX_AGE_SECONDS * 1000,
        pw: await passwordMark(password),
        bind: (await sha256Hex(binding)).slice(0, 16),
      }),
    ),
  );
  const signature = await hmac(secret, `${PURPOSE}.${body}`);
  return `${body}.${signature}`;
}

export async function adminTokenValid(
  token: string,
  secret: string,
  password: string,
  binding: string,
  now = Date.now(),
) {
  if (!secret || !password || !token || !binding) return false;
  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra) return false;

  const expected = await hmac(secret, `${PURPOSE}.${body}`);
  if (!sameString(expected, signature)) return false;

  try {
    const payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(body))) as {
      exp?: unknown;
      pw?: unknown;
      bind?: unknown;
    };
    if (typeof payload.exp !== "number" || !Number.isFinite(payload.exp)) return false;
    if (payload.exp <= now || payload.exp > now + ADMIN_MAX_AGE_SECONDS * 1000 + 60_000) return false;
    const mark = (await sha256Hex(binding)).slice(0, 16);
    return (
      typeof payload.pw === "string" &&
      sameString(payload.pw, await passwordMark(password)) &&
      typeof payload.bind === "string" &&
      sameString(payload.bind, mark)
    );
  } catch {
    return false;
  }
}
