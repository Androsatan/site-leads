import { NextResponse, type NextRequest } from "next/server";
import { adminCookieName, adminTokenValid, sessionBinding } from "@/lib/admin-token";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/admin/login") return NextResponse.next();

  const secure = process.env.NODE_ENV === "production";
  const token = request.cookies.get(adminCookieName(secure))?.value ?? "";
  const secret = process.env.DOWNLOAD_TOKEN_SECRET?.trim() ?? "";
  const password = process.env.ADMIN_PASSWORD?.trim() ?? "";
  const binding = sessionBinding(
    request.headers.get("x-forwarded-for"),
    request.headers.get("x-real-ip"),
    request.headers.get("user-agent"),
  );
  if (await adminTokenValid(token, secret, password, binding)) return NextResponse.next();

  const login = request.nextUrl.clone();
  login.pathname = "/admin/login";
  login.search = "";
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
