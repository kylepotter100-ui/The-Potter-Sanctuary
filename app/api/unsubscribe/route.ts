import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { isUuid } from "@/lib/marketing";
import { checkRateLimit, clientIpFrom, hashIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

// One-click unsubscribe (RFC 8058): mail providers POST here with
// "List-Unsubscribe=One-Click"; the /unsubscribe page posts here too.
// The token is the only key — no sign-in, no other data revealed.
export async function POST(req: Request) {
  const url = new URL(req.url);
  let token = url.searchParams.get("t");
  if (!token) {
    const form = await req.formData().catch(() => null);
    token = (form?.get("t") as string | null) ?? null;
  }
  if (!isUuid(token) || !supabaseAdmin) {
    return NextResponse.json({ error: "Invalid link" }, { status: 400 });
  }
  const { allowed } = await checkRateLimit(supabaseAdmin, "unsubscribe", await hashIp(clientIpFrom(req)), {
    limit: 30,
    windowMinutes: 10,
  });
  if (!allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const { error } = await supabaseAdmin
    .from("customers")
    .update({ marketing_opt_in: false })
    .eq("unsubscribe_token", token);
  if (error) {
    console.error("[unsubscribe] failed", error.code, error.message);
    return NextResponse.json({ error: "Could not unsubscribe" }, { status: 500 });
  }
  // Same answer whether or not the token matched — reveals nothing.
  return NextResponse.json({ ok: true });
}
