import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Supabase is not configured on the server" },
      { status: 500 }
    );
  }

  let body: { date?: string; reason?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { date, reason } = body;
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: "Invalid date — expected YYYY-MM-DD" },
      { status: 400 }
    );
  }

  // Idempotent — the day-toggle workflow may call this for a date that was
  // already blocked (e.g. quick double-tap). Upsert avoids the unique
  // constraint violation on blocked_date.
  const { data, error } = await supabaseAdmin
    .from("blocked_dates")
    .upsert(
      { blocked_date: date, reason: reason ?? null },
      { onConflict: "blocked_date" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
