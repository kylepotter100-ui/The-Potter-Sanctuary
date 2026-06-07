import { NextResponse, type NextRequest } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_VALUE,
  adminSessionCookie,
} from "@/lib/admin-session";

export function middleware(req: NextRequest) {
  const session = req.cookies.get(ADMIN_SESSION_COOKIE);
  if (!session || session.value !== ADMIN_SESSION_VALUE) {
    const loginUrl = new URL("/admin", req.url);
    loginUrl.searchParams.set("reason", "expired");
    // Unauthenticated: redirect to login and NEVER set a session cookie. This is
    // the only gate, and it stays intact.
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

// Protect every route under /admin EXCEPT /admin itself (the login page).
// `:path+` requires at least one segment after /admin, so /admin alone is excluded.
export const config = {
  matcher: ["/admin/:path+"],
};
