import { NextResponse } from "next/server";
import { clearAdminSessionCookie } from "@/lib/admin-session";

function clearCookie(res: NextResponse) {
  res.cookies.set(clearAdminSessionCookie());
  return res;
}

export async function POST(req: Request) {
  const url = new URL("/admin", req.url);
  return clearCookie(NextResponse.redirect(url, { status: 303 }));
}

export async function GET(req: Request) {
  return POST(req);
}
