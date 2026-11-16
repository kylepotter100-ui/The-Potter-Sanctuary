import { NextResponse } from "next/server";
import { clearAdminSessionCookie } from "@/lib/admin-session";

// POST only (the admin header submits a form). A GET handler let any page
// sign the owner out with an <img src="/api/admin/logout">.
export async function POST(req: Request) {
  const url = new URL("/admin", req.url);
  const res = NextResponse.redirect(url, { status: 303 });
  res.cookies.set(clearAdminSessionCookie());
  return res;
}
