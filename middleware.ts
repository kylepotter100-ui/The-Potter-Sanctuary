import { NextResponse, type NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const session = req.cookies.get("admin_session");
  if (!session || session.value !== "authenticated") {
    const loginUrl = new URL("/admin", req.url);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

// Protect every route under /admin EXCEPT /admin itself (the login page).
// `:path+` requires at least one segment after /admin, so /admin alone is excluded.
export const config = {
  matcher: ["/admin/:path+"],
};
