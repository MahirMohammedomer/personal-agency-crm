import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "meda_session";

/** Always reachable without a session. */
const PUBLIC_PATHS = new Set([
  "/login",
  "/api/health",
  "/api/auth",
  "/manifest.webmanifest",
  "/sw.js",
  "/offline.html",
  "/favicon.ico",
]);

function isPublic(pathname: string) {
  if (PUBLIC_PATHS.has(pathname)) return true;
  return (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/icons/") ||
    pathname === "/sample-leads.csv"
  );
}

/**
 * Cheap gate so unauthenticated navigation redirects instantly. Cryptographic
 * verification of the session happens server-side in every API route
 * (see `requireAuth`), so this is a UX layer, not the security boundary.
 */
export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  if (hasSession) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
