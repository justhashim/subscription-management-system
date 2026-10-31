import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, decodeSession } from "./lib/auth/cookie";

const protectedRoutes = [
  "/dashboard",
  "/users",
  "/products",
  "/plans",
  "/subscriptions",
  "/customers",
  "/quotations",
  "/invoices",
  "/payments",
  "/billing",
  "/discounts",
  "/reports",
  "/portal",
];
const authRoutes = ["/login", "/register"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = decodeSession(
    request.cookies.get(SESSION_COOKIE)?.value,
  );

  const isProtected = protectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
  const isAuthRoute = authRoutes.includes(pathname);

  if (!session && isProtected) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (session && isAuthRoute) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (session && pathname.startsWith("/users") && session.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/users/:path*",
    "/products/:path*",
    "/plans/:path*",
    "/subscriptions/:path*",
    "/customers/:path*",
    "/quotations/:path*",
    "/invoices/:path*",
    "/payments/:path*",
    "/billing/:path*",
    "/discounts/:path*",
    "/reports/:path*",
    "/portal/:path*",
    "/login",
    "/register",
  ],
};
