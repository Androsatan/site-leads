import { createHash, timingSafeEqual } from "crypto";
import { cookies, headers } from "next/headers";
import { ADMIN_MAX_AGE_SECONDS, adminCookieName, adminTokenValid, createAdminToken, sessionBinding } from "@/lib/admin-token";
import { requireEnv } from "@/lib/env";

function secureCookie() {
  return process.env.NODE_ENV === "production";
}

function sessionSecret() {
  return process.env.DOWNLOAD_TOKEN_SECRET?.trim() ?? "";
}

function sessionPassword() {
  return process.env.ADMIN_PASSWORD?.trim() ?? "";
}

export function adminPasswordConfigured() {
  return Boolean(sessionPassword());
}

export function checkAdminPassword(password: string) {
  const expected = sessionPassword();
  if (!expected || !password) return false;
  const left = createHash("sha256").update(password).digest();
  const right = createHash("sha256").update(expected).digest();
  return timingSafeEqual(left, right);
}

function cookieOptions(secure: boolean) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge: ADMIN_MAX_AGE_SECONDS,
  };
}

async function currentBinding() {
  const headerList = await headers();
  return sessionBinding(headerList.get("x-forwarded-for"), headerList.get("x-real-ip"), headerList.get("user-agent"));
}

export async function isAdmin() {
  const token = (await cookies()).get(adminCookieName(secureCookie()))?.value;
  if (!token) return false;
  return adminTokenValid(token, sessionSecret(), sessionPassword(), await currentBinding());
}

export async function startAdminSession() {
  const secret = requireEnv("DOWNLOAD_TOKEN_SECRET");
  const password = sessionPassword();
  if (!password) throw new Error("ADMIN_PASSWORD ausente");

  const secure = secureCookie();
  const token = await createAdminToken(secret, password, await currentBinding());
  (await cookies()).set(adminCookieName(secure), token, cookieOptions(secure));
}

export async function endAdminSession() {
  const jar = await cookies();
  const blank = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: 0 };
  jar.set(adminCookieName(false), "", { ...blank, secure: false });
  jar.set(adminCookieName(true), "", { ...blank, secure: true });
}
