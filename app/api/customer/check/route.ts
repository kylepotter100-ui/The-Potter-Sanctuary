import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// Lightweight existence check used by the booking form to detect a
// returning customer as they type their email. Returns ONLY a boolean —
// never any customer data — so it's safe to call before authentication.
export async function POST(req: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ exists: false });
  }

  let body: { email?: string };
  try {
    body = (await req.json()) as { email?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  if (!email || !/\S+@\S+\.\S+/.test(email)) {
    return NextResponse.json({ exists: false });
  }

  const { data } = await supabaseAdmin
    .from("customers")
    .select("id", { head: false })
    .eq("email", email)
    .maybeSingle();

  return NextResponse.json(
    { exists: !!data },
    { headers: { "Cache-Control": "private, no-cache, no-store" } }
  );
}
