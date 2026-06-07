import { NextResponse } from "next/server";
import { adminSessionCookie } from "@/lib/admin-session";

// Constant-time password check using Web Crypto (crypto.subtle) — a standard
// global available in BOTH Node and the Cloudflare Workers runtime. node:crypto
// (createHash/timingSafeEqual) threw in workerd and 500'd login in production, so
// we avoid it. SHA-256 both sides to equal-length digests, then compare in
// constant time.
async function passwordMatches(
  provided: string,
  expected: string
): Promise<boolean> {
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(provided)),
    crypto.subtle.digest("SHA-256", enc.encode(expected)),
  ]);
  const av = new Uint8Array(a);
  const bv = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < av.length; i++) diff |= av[i] ^ bv[i];
  return diff === 0;
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

  if (
    typeof body.password !== "string" ||
    !(await passwordMatches(body.password, expected))
  ) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(adminSessionCookie());
  return res;
}
