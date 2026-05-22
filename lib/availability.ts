import type { SupabaseClient } from "@supabase/supabase-js";

// Shared server-side slot resolution. Mirrors the client-side freeSlotsFor
// logic in components/Booking.tsx so /api/booking validates against the same
// source of truth the calendar renders from:
//   resolved-open(date) = (day_of_week template ∪ active slot_overrides)
//                         − inactive slot_overrides
//   …minus blocked dates and slots already taken by a pending/confirmed booking.

export type SlotValidation = { ok: true } | { ok: false; reason: string };

function toHHMM(t: string): string {
  return String(t).slice(0, 5);
}

// Weekday (0=Sun … 6=Sat) of a YYYY-MM-DD date. Parsed at noon UTC so the
// calendar day is unambiguous regardless of server timezone.
function weekdayOf(dateIso: string): number {
  return new Date(`${dateIso}T12:00:00Z`).getUTCDay();
}

/**
 * Validate that a specific (date, time) slot is genuinely bookable right now.
 * Returns { ok: false, reason } with a customer-friendly message on failure.
 */
export async function validateSlotAvailable(
  admin: SupabaseClient,
  dateIso: string,
  time: string
): Promise<SlotValidation> {
  const slot = toHHMM(time);
  const todayIso = new Date().toISOString().slice(0, 10);

  // 1. Past date.
  if (dateIso < todayIso) {
    return { ok: false, reason: "That date has already passed." };
  }

  const dow = weekdayOf(dateIso);

  const [
    { data: blocked },
    { data: template },
    { data: overrides, error: overridesErr },
    { data: existing },
  ] = await Promise.all([
    admin
      .from("blocked_dates")
      .select("blocked_date")
      .eq("blocked_date", dateIso)
      .maybeSingle(),
    admin
      .from("availability")
      .select("slot_time")
      .eq("is_active", true)
      .eq("day_of_week", dow),
    admin
      .from("slot_overrides")
      .select("slot_time, is_active")
      .eq("override_date", dateIso),
    admin
      .from("bookings")
      .select("id")
      .eq("booking_date", dateIso)
      .eq("booking_time", slot.length === 5 ? `${slot}:00` : slot)
      .in("status", ["pending", "confirmed"])
      .maybeSingle(),
  ]);

  if (overridesErr) {
    // slot_overrides table may be absent on an un-migrated DB — proceed
    // using just the day_of_week template + blocked dates.
    console.error(
      "[validateSlotAvailable] slot_overrides read failed",
      JSON.stringify(overridesErr)
    );
  }

  // 2. Whole day blocked.
  if (blocked) {
    return { ok: false, reason: "This date is no longer available." };
  }

  // 3. Resolve the open set for this date: template ∪ active overrides,
  //    then remove inactive overrides.
  const open = new Set<string>();
  for (const row of template ?? []) open.add(toHHMM(row.slot_time as string));
  for (const row of overrides ?? []) {
    const t = toHHMM(row.slot_time as string);
    if (row.is_active) open.add(t);
    else open.delete(t);
  }

  // 4. Slot not offered on this date.
  if (!open.has(slot)) {
    return { ok: false, reason: "This time slot is no longer available." };
  }

  // 5. Slot already taken (the partial unique index is the hard guard; this
  //    returns a cleaner error first).
  if (existing) {
    return {
      ok: false,
      reason: "Sorry, that time slot was just taken — please pick another time.",
    };
  }

  return { ok: true };
}
