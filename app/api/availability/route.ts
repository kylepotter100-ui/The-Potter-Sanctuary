import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Public read of availability + blocked dates so the booking calendar can
// render real opening hours and blackout days. Uses the service role client
// because RLS isn't configured for anon reads on these tables — the data is
// non-sensitive (opening hours / closed days) so this is fine.
//
// Booked slots, slot overrides and blocked dates are returned for a 60-day
// horizon (was 90). Trimming the window keeps the response small enough to
// stay well inside Cloudflare's per-request CPU budget.
const HORIZON_DAYS = 60;

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
  horizon.setDate(horizon.getDate() + HORIZON_DAYS);
  const horizonIso = horizon.toISOString().slice(0, 10);

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
      .select("booking_date, booking_time")
      .gte("booking_date", todayIso)
      .lte("booking_date", horizonIso)
      .in("status", ["pending", "confirmed"]),
    supabaseAdmin
      .from("slot_overrides")
      .select("override_date, slot_time, is_active")
      .gte("override_date", todayIso)
      .lte("override_date", horizonIso),
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

  const bookedSlots: Record<string, string[]> = {};
  for (const row of booked ?? []) {
    const date = row.booking_date as string;
    const time = String(row.booking_time).slice(0, 5);
    (bookedSlots[date] ||= []).push(time);
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
