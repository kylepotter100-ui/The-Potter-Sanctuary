import { NextResponse } from "next/server";

function clearCookie(res: NextResponse) {
  res.cookies.set("admin_session", "", {
    httpOnly: true,
    sameSite: "strict",
    secure: true,
    path: "/",
    maxAge: 0,
  });
  return res;
}

export async function POST(req: Request) {
  const url = new URL("/admin", req.url);
  return clearCookie(NextResponse.redirect(url, { status: 303 }));
}

export async function GET(req: Request) {
  return POST(req);
}
