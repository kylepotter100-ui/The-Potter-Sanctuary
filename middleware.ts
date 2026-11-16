import { NextResponse, type NextRequest } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  adminSessionCookie,
  adminSessionSecret,
  createAdminSessionToken,
  verifyAdminSessionToken,
} from "@/lib/admin-session";

export async function middleware(req: NextRequest) {
  const secret = adminSessionSecret();
  const token = req.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (!secret || !(await verifyAdminSessionToken(secret, token))) {
    const loginUrl = new URL("/admin", req.url);
    loginUrl.searchParams.set("reason", "expired");
    // Unauthenticated: redirect to login and NEVER set a session cookie.
    return NextResponse.redirect(loginUrl);
  }
  // Authenticated: rolling session — re-issue a freshly signed token with a
  // new 30-day expiry. Reached only after the signature check above, so this
  // refreshes a valid session and can never create one.
  const res = NextResponse.next();
  res.cookies.set(adminSessionCookie(await createAdminSessionToken(secret)));
  return res;
}

// Protect every route under /admin EXCEPT /admin itself (the login page).
// `:path+` requires at least one segment after /admin, so /admin alone is excluded.
export const config = {
  matcher: ["/admin/:path+"],
};
