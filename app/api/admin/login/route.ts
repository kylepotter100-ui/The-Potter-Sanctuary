import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { adminSessionCookie } from "@/lib/admin-session";

// Constant-time password check. We SHA-256 both sides first so the buffers are
// always equal length — this avoids timingSafeEqual throwing on length mismatch
// (which would itself leak the password length) and removes the early-exit timing
// side-channel of `===`.
function passwordMatches(provided: string, expected: string): boolean {
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  let body: { password?: string };
  try {
    body = (await req.json()) as { password?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    return NextResponse.json(
      { error: "Admin password is not configured on the server" },
      { status: 500 }
    );
  }

  if (typeof body.password !== "string" || !passwordMatches(body.password, expected)) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(adminSessionCookie());
  return res;
}
