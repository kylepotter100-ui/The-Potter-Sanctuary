import { NextResponse } from "next/server";
import {
  adminSessionCookie,
  adminSessionSecret,
  constantTimeEqual,
  createAdminSessionToken,
} from "@/lib/admin-session";
import { supabaseAdmin } from "@/lib/supabase";
import { checkRateLimit, clientIpFrom, hashIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// Per-IP budget for password attempts. Generous for one owner on a few
// devices, useless for guessing.
const LOGIN_LIMIT = { limit: 10, windowMinutes: 15 };

export async function POST(req: Request) {
  let body: { password?: string };
  try {
    body = (await req.json()) as { password?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const expected = process.env.ADMIN_PASSWORD;
  const secret = adminSessionSecret();
  if (!expected || !secret) {
    // Fail closed. ADMIN_SESSION_SECRET (>= 32 chars) signs the session.
    console.error(
      "[admin login] ADMIN_PASSWORD or ADMIN_SESSION_SECRET missing/too short"
    );
    return NextResponse.json(
      { error: "Admin sign-in is not configured on the server" },
      { status: 500 }
    );
  }

  if (supabaseAdmin) {
    const { allowed } = await checkRateLimit(
      supabaseAdmin,
      "admin-login",
      await hashIp(clientIpFrom(req)),
      LOGIN_LIMIT
    );
    if (!allowed) {
      return NextResponse.json(
        {
          error:
            "Too many sign-in attempts. Please wait 15 minutes and try again.",
        },
        { status: 429 }
      );
    }
  }

  if (
    typeof body.password !== "string" ||
    body.password.length > 256 ||
    !(await constantTimeEqual(body.password, expected))
  ) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(adminSessionCookie(await createAdminSessionToken(secret)));
  return res;
}
