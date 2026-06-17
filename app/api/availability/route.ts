import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { addDaysIso, ukTodayIso } from "@/lib/uk-time";
import { HORIZON_DAYS, fetchSlotOverridesInWindow } from "@/lib/availability";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Public read of availability + blocked dates so the booking calendar can
// render real opening hours and blackout days. Uses the service role client
// because RLS isn't configured for anon reads on these tables — the data is
// non-sensitive (opening hours / closed days) so this is fine.
//
// Booked slots, slot overrides and blocked dates are returned for the shared
// HORIZON_DAYS window (lib/availability.ts). Trimming the window keeps the
// response small enough to stay well inside Cloudflare's per-request CPU budget.

export async function GET() {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Supabase is not configured on the server" },
      { status: 500 }
    );
  }

  // UK business "today", not the server's UTC date (they differ for an hour
  // around midnight during BST).
  const todayIso = ukTodayIso();
  const horizonIso = addDaysIso(todayIso, HORIZON_DAYS);

  const [
    { data: availability, error: availErr },
    { data: blocked, error: blockErr },
    { data: booked, error: bookedErr },
    { data: overrides, error: overridesErr },
  ] = await Promise.all([
    supabaseAdmin
      .from("availability")
      .select("day_of_week, slot_time")
      .eq("is_active", true),
    supabaseAdmin
      .from("blocked_dates")
      .select("blocked_date")
      .gte("blocked_date", todayIso)
      .lte("blocked_date", horizonIso),
    supabaseAdmin
      .from("bookings")
      .select("booking_date, booking_time, duration_minutes")
      .gte("booking_date", todayIso)
      .lte("booking_date", horizonIso)
      .in("status", ["pending", "confirmed"]),
    // Paged: a plain select caps at 1000 rows and silently dropped the later
    // in-window dates, making the public calendar wrong there (see
    // lib/availability.ts).
    fetchSlotOverridesInWindow(supabaseAdmin, todayIso, horizonIso),
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
  if (overridesErr) {
    // Phase 4 schema may not be applied yet — log and continue without overrides.
    console.error("[availability] slot_overrides read failed", overridesErr);
  }

  const slotsByDay: Record<number, string[]> = {};
  for (const row of availability ?? []) {
    const t = String(row.slot_time).slice(0, 5);
    const dow = row.day_of_week as number;
    (slotsByDay[dow] ||= []).push(t);
  }
  for (const k in slotsByDay) {
    slotsByDay[Number(k)].sort();
  }

  const blockedDates = (blocked ?? []).map((b) => b.blocked_date as string);

  // Each booking is returned with its duration so the shared helper can derive
  // the [start, start+duration+buffer) interval client-side. End times are not
  // pre-computed here.
  const bookedSlots: Record<string, { time: string; duration: number }[]> = {};
  for (const row of booked ?? []) {
    const date = row.booking_date as string;
    const time = String(row.booking_time).slice(0, 5);
    // Defensive default for any un-backfilled (pre-migration) row.
    const duration = (row.duration_minutes as number | null) ?? 60;
    (bookedSlots[date] ||= []).push({ time, duration });
  }

  const slotOverrides: Record<string, Record<string, boolean>> = {};
  for (const row of overrides ?? []) {
    const date = row.override_date as string;
    const time = String(row.slot_time).slice(0, 5);
    (slotOverrides[date] ||= {})[time] = row.is_active as boolean;
  }

  return NextResponse.json(
    { slotsByDay, blockedDates, bookedSlots, slotOverrides },
    {
      headers: {
        "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
        "CDN-Cache-Control": "no-store",
        "Cloudflare-CDN-Cache-Control": "no-store",
        Pragma: "no-cache",
        Expires: "0",
      },
    }
  );
}
