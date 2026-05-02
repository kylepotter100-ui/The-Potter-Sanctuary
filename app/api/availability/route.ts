import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Public read of availability + blocked dates so the booking calendar can
// render real opening hours and blackout days. Uses the service role client
// because RLS isn't configured for anon reads on these tables — the data is
// non-sensitive (opening hours / closed days) so this is fine.
//
// Also returns a `bookedSlots` map (date → ["HH:MM", ...]) for the next
// 90 days so the calendar can hide already-taken slots. Cancelled bookings
// are excluded so a freed slot reappears automatically.
export async function GET() {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Supabase is not configured on the server" },
      { status: 500 }
    );
  }

  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + 90);
  const horizonIso = horizon.toISOString().slice(0, 10);

  const [
    { data: availability, error: availErr },
    { data: blocked, error: blockErr },
    { data: booked, error: bookedErr },
  ] = await Promise.all([
    supabaseAdmin
      .from("availability")
      .select("day_of_week, slot_time, is_active")
      .eq("is_active", true),
    supabaseAdmin
      .from("blocked_dates")
      .select("blocked_date")
      .gte("blocked_date", todayIso),
    supabaseAdmin
      .from("bookings")
      .select("booking_date, booking_time, status")
      .gte("booking_date", todayIso)
      .lte("booking_date", horizonIso)
      .in("status", ["pending", "confirmed"]),
  ]);

  if (availErr || blockErr || bookedErr) {
    return NextResponse.json(
      {
        error:
          availErr?.message ??
          blockErr?.message ??
          bookedErr?.message ??
          "Read failed",
      },
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

  const bookedSlots: Record<string, string[]> = {};
  for (const row of booked ?? []) {
    const date = row.booking_date as string;
    const time = String(row.booking_time).slice(0, 5);
    if (!bookedSlots[date]) bookedSlots[date] = [];
    bookedSlots[date].push(time);
  }

  return NextResponse.json(
    { slotsByDay, blockedDates, bookedSlots },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0, must-revalidate",
      },
    }
  );
}
