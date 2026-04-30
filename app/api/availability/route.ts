import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Public read of availability + blocked dates so the booking calendar can
// render real opening hours and blackout days. Uses the service role client
// because RLS isn't configured for anon reads on these tables — the data is
// non-sensitive (opening hours / closed days) so this is fine.
export async function GET() {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Supabase is not configured on the server" },
      { status: 500 }
    );
  }

  const today = new Date().toISOString().slice(0, 10);

  const [{ data: availability, error: availErr }, { data: blocked, error: blockErr }] =
    await Promise.all([
      supabaseAdmin
        .from("availability")
        .select("day_of_week, slot_time, is_active")
        .eq("is_active", true),
      supabaseAdmin
        .from("blocked_dates")
        .select("blocked_date")
        .gte("blocked_date", today),
    ]);

  if (availErr || blockErr) {
    return NextResponse.json(
      { error: availErr?.message ?? blockErr?.message ?? "Read failed" },
      { status: 500 }
    );
  }

  const slotsByDay: Record<number, string[]> = {};
  for (const row of availability ?? []) {
    const t = String(row.slot_time).slice(0, 5);
    if (!slotsByDay[row.day_of_week]) slotsByDay[row.day_of_week] = [];
    slotsByDay[row.day_of_week].push(t);
  }
  for (const k of Object.keys(slotsByDay)) {
    slotsByDay[Number(k)].sort();
  }

  const blockedDates = (blocked ?? []).map((b) => b.blocked_date as string);

  return NextResponse.json(
    { slotsByDay, blockedDates },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0, must-revalidate",
      },
    }
  );
}
