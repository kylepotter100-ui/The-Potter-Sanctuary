import { NextResponse } from "next/server";
import { clearAdminSessionCookie } from "@/lib/admin-session";

function clearCookie(res: NextResponse) {
  res.cookies.set(clearAdminSessionCookie());
  return res;
}

// POST-only on purpose: a GET logout would be triggerable cross-site via <img>/
// prefetch (sameSite=lax sends the cookie on top-level GETs), an annoyance-CSRF.
// The app logs out via a POST form (components/AdminHeader.tsx).
export async function POST(req: Request) {
  const url = new URL("/admin", req.url);
  return clearCookie(NextResponse.redirect(url, { status: 303 }));
}
