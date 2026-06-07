import { NextResponse, type NextRequest } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_VALUE,
  adminSessionCookie,
} from "@/lib/admin-session";

// Public admin auth endpoints that MUST stay reachable without a session, or
// login/logout would deadlock. Everything else under /admin and /api/admin is gated.
const PUBLIC_ADMIN_PATHS = new Set(["/api/admin/login", "/api/admin/logout"]);

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Never gate the login/logout endpoints themselves.
  if (PUBLIC_ADMIN_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  const isApi = pathname.startsWith("/api/");
  const session = req.cookies.get(ADMIN_SESSION_COOKIE);

  if (!session || session.value !== ADMIN_SESSION_VALUE) {
    // Unauthenticated: NEVER set a session cookie. This is the only gate, intact.
    // API callers get a clean 401 JSON; page navigations get the login redirect.
    if (isApi) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/admin", req.url);
    loginUrl.searchParams.set("reason", "expired");
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated: rolling session — re-issue the cookie with a fresh 30-day
  // expiry so the clock resets on every visit (sliding window). Reached only
  // after the valid-session check above, so this refreshes an existing session
  // and can never create one.
  const res = NextResponse.next();
  res.cookies.set(adminSessionCookie());
  return res;
}

// Protect every route under /admin EXCEPT /admin itself (the login page), plus the
// admin API as defense-in-depth (each route also self-checks). `:path+` requires at
// least one segment after /admin, so the /admin login page is excluded; login/logout
// API endpoints are allow-listed inside middleware().
export const config = {
  matcher: ["/admin/:path+", "/api/admin/:path+"],
};
