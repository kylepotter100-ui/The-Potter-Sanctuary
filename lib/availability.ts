import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { services } from "@/lib/services";
import { ukNow } from "@/lib/uk-time";

// ============================================================================
// Duration-aware availability — the single source of truth for slot logic,
// shared by the public calendar (components/Booking.tsx), the availability API,
// and the server-side booking validator below. No slot logic lives anywhere
// else.
//
// Interval model:
//   - The studio opens 09:30 and CLOSES 19:00; a session must FINISH by 19:00.
//   - 15-minute grid.
//   - Every booking reserves the half-open interval
//       [start, start + duration_minutes + BUFFER_MINUTES)
//     i.e. the session plus a 15-min buffer. End-exclusive, so a session ending
//     at 14:00 (buffer to 14:15) leaves 14:15 free as the next valid start.
//   - A candidate { start, duration } is VALID iff:
//       (a) start + duration <= 19:00 (finishes by close; the buffer may spill
//           past close — an 18:00 60-min session is valid),
//       (b) its interval doesn't intersect any existing pending/confirmed
//           booking's interval, and
//       (c) every 15-min segment the SESSION (not the buffer) spans is in the
//           date's open set.
// ============================================================================

/** Gap enforced after every session before the next one may start. */
export const BUFFER_MINUTES = 15;
/** Studio opening time (first occupiable segment). */
export const OPEN_TIME = "09:30";
/** Studio closing time — sessions must finish by this. */
export const CLOSE_TIME = "19:00";

/**
 * How many days ahead availability is read and managed. The admin panel, the
 * public availability API and the admin week-navigation cap all derive their
 * forward window from this ONE value, so the read window, the write surface and
 * the navigable range can never drift apart (a mismatch silently dropped
 * far-future slot toggles — they saved but were never re-read, so the day
 * flashed green then reverted). Caitlin confirmed 60 days is sufficient.
 */
export const HORIZON_DAYS = 60;

/** Grid granularity in minutes. */
const GRID_MINUTES = 15;

/** An existing booking's footprint, as stored: start time + session length. */
export type ExistingBooking = { time: string; duration_minutes: number };

export type SlotValidation = { ok: true } | { ok: false; reason: string };

/** A single slot_overrides row, as read for the management/calendar window. */
export type SlotOverrideRow = {
  override_date: string;
  slot_time: string;
  is_active: boolean;
};

/**
 * Read EVERY slot_overrides row in [fromIso, toIso] inclusive, paging past
 * PostgREST's 1000-row response cap.
 *
 * A plain `.select().gte().lte()` silently truncates at 1000 rows. Opening a
 * template-less day seeds ~38 override rows, so within the HORIZON_DAYS window
 * the table can exceed 1000 — and the dropped rows are the LATER in-window
 * dates (the read used no order, so the cut was arbitrary). Those dates then
 * fell back to the weekly template in the grid; toggling a slot wrote a row
 * that was still beyond the cap on the next read, so it "reverted". Paging in
 * deterministic (date, time) order returns the whole window every time.
 */
export async function fetchSlotOverridesInWindow(
  admin: SupabaseClient,
  fromIso: string,
  toIso: string
): Promise<{ data: SlotOverrideRow[]; error: PostgrestError | null }> {
  const PAGE = 1000;
  const all: SlotOverrideRow[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await admin
      .from("slot_overrides")
      .select("override_date, slot_time, is_active")
      .gte("override_date", fromIso)
      .lte("override_date", toIso)
      .order("override_date", { ascending: true })
      .order("slot_time", { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) return { data: all, error };
    const rows = (data ?? []) as SlotOverrideRow[];
    all.push(...rows);
    if (rows.length < PAGE) break;
  }
  return { data: all, error: null };
}

function toHHMM(t: string): string {
  return String(t).slice(0, 5);
}

/** Minutes since midnight for an "HH:MM" (or "HH:MM:SS") time. */
export function timeToMinutes(t: string): number {
  const [hh, mm] = toHHMM(t).split(":");
  return parseInt(hh, 10) * 60 + parseInt(mm, 10);
}

/** "HH:MM" for a minutes-since-midnight value. */
export function minutesToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const OPEN_MIN = timeToMinutes(OPEN_TIME);
const CLOSE_MIN = timeToMinutes(CLOSE_TIME);

// Weekday (0=Sun … 6=Sat) of a YYYY-MM-DD date. Parsed at noon UTC so the
// calendar day is unambiguous regardless of server timezone.
function weekdayOf(dateIso: string): number {
  return new Date(`${dateIso}T12:00:00Z`).getUTCDay();
}

/**
 * Why a candidate failed, or null if it's valid. Pure — no I/O. `start` is the
 * "HH:MM" start time, `duration` the session length in minutes, `openSet` the
 * resolved set of open 15-min segments ("HH:MM") for the date, `existing` the
 * other pending/confirmed bookings that day.
 */
export function candidateRejection(args: {
  openSet: Set<string>;
  existing: ExistingBooking[];
  start: string;
  duration: number;
  // Admin "book anytime" mode: the studio owner is fitting in a manual booking,
  // so the open-set (published-slot) and closing-time rules are intentionally
  // skipped — any day, any time of day is allowed. The overlap check (b) STILL
  // runs and the DB bookings_no_overlap constraint remains the hard backstop, so
  // a real clash with an existing appointment can never be created.
  adminMode?: boolean;
}): "closing" | "overlap" | "closed-segment" | null {
  const startMin = timeToMinutes(args.start);
  const sessionEnd = startMin + args.duration;

  if (!args.adminMode) {
    // (a) Session must finish by close.
    if (sessionEnd > CLOSE_MIN || startMin < OPEN_MIN) return "closing";

    // (c) Every 15-min segment the session spans must be open. The session
    //     [startMin, sessionEnd) occupies blocks startMin, startMin+15, … up to
    //     but not including sessionEnd.
    for (let m = startMin; m < sessionEnd; m += GRID_MINUTES) {
      if (!args.openSet.has(minutesToTime(m))) return "closed-segment";
    }
  }

  // (b) Candidate interval [start, start+duration+buffer) must not intersect any
  //     existing booking's interval. Half-open intersection test.
  const candStart = startMin;
  const candEnd = startMin + args.duration + BUFFER_MINUTES;
  for (const b of args.existing) {
    const bStart = timeToMinutes(b.time);
    const bEnd = bStart + b.duration_minutes + BUFFER_MINUTES;
    if (candStart < bEnd && bStart < candEnd) return "overlap";
  }

  return null;
}

/** True iff the candidate { start, duration } is valid per the interval model. */
export function isCandidateValid(args: {
  openSet: Set<string>;
  existing: ExistingBooking[];
  start: string;
  duration: number;
}): boolean {
  return candidateRejection(args) === null;
}

/**
 * The list of valid START times for a given duration on a date, given the open
 * set and the day's existing bookings. Sorted ascending.
 */
export function validStartTimes(
  openSet: Set<string>,
  existing: ExistingBooking[],
  duration: number
): string[] {
  return Array.from(openSet)
    .sort()
    .filter((start) => isCandidateValid({ openSet, existing, start, duration }));
}

/**
 * Which treatments (by bookingId) FIT at a given start time, given the open set
 * and the day's existing bookings. Used for the Step-2 grey-out.
 */
export function fittingTreatments(
  openSet: Set<string>,
  existing: ExistingBooking[],
  start: string
): string[] {
  return services
    .filter((s) =>
      isCandidateValid({ openSet, existing, start, duration: s.durationMinutes })
    )
    .map((s) => s.bookingId);
}

/**
 * Resolve a date's open 15-min segment set from the day_of_week template plus
 * per-date overrides: (template ∪ active overrides) − inactive overrides.
 * Blocked-date handling is the caller's responsibility.
 */
export function resolveOpenSet(
  template: { slot_time: string }[],
  overrides: { slot_time: string; is_active: boolean }[]
): Set<string> {
  const open = new Set<string>();
  for (const row of template) open.add(toHHMM(row.slot_time));
  for (const row of overrides) {
    const t = toHHMM(row.slot_time);
    if (row.is_active) open.add(t);
    else open.delete(t);
  }
  return open;
}

/**
 * Validate that a specific (date, time) booking of the given duration is
 * genuinely bookable right now. Fetches all pending/confirmed bookings for the
 * date (with their durations) and runs the same shared validity check the
 * calendar uses. Returns { ok: false, reason } with a customer-friendly message.
 */
export async function validateSlotAvailable(
  admin: SupabaseClient,
  dateIso: string,
  time: string,
  durationMinutes: number,
  // Admin "book anytime" mode (manual booking by the owner): skip the
  // blocked-date, same-day lead-time, open-set and closing checks; keep the
  // past-date guard and the overlap check. See candidateRejection.
  opts: { adminMode?: boolean } = {}
): Promise<SlotValidation> {
  const adminMode = opts.adminMode === true;
  const slot = toHHMM(time);
  // UK business date/time, not the server's UTC clock — during BST the two
  // diverge for an hour around midnight (and a UK wall time read as UTC is an
  // hour late all summer).
  const { dateIso: todayIso, minutes: nowMinutes } = ukNow();

  // 1. Past date.
  if (dateIso < todayIso) {
    return { ok: false, reason: "That date has already passed." };
  }

  // 1b. Same-day lead time: mirror the calendar's rule (a slot must start at
  // least 15 minutes from now) so a direct API call can't book a slot the UI
  // would never offer — including ones that have already started. Skipped in
  // admin mode so the owner can log an earlier-today walk-in.
  if (!adminMode && dateIso === todayIso && timeToMinutes(slot) < nowMinutes + 15) {
    return { ok: false, reason: "That time has already passed — please pick a later slot." };
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
      .select("booking_time, duration_minutes")
      .eq("booking_date", dateIso)
      .in("status", ["pending", "confirmed"]),
  ]);

  if (overridesErr) {
    // slot_overrides table may be absent on an un-migrated DB — proceed
    // using just the day_of_week template + blocked dates.
    console.error(
      "[validateSlotAvailable] slot_overrides read failed",
      JSON.stringify(overridesErr)
    );
  }

  // 2. Whole day blocked. Ignored in admin mode (owner can book a blocked day).
  if (blocked && !adminMode) {
    return { ok: false, reason: "This date is no longer available." };
  }

  // 3. Resolve the open set for this date.
  const openSet = resolveOpenSet(
    (template ?? []) as { slot_time: string }[],
    (overrides ?? []) as { slot_time: string; is_active: boolean }[]
  );

  // 4. Run the shared interval check against the day's existing bookings.
  const existingBookings: ExistingBooking[] = (existing ?? []).map((b) => ({
    time: toHHMM(b.booking_time as string),
    // Defensive: an un-backfilled row (pre-migration) defaults to a 60-min
    // footprint rather than 0 so it still blocks conservatively.
    duration_minutes: (b.duration_minutes as number | null) ?? 60,
  }));

  const rejection = candidateRejection({
    openSet,
    existing: existingBookings,
    start: slot,
    duration: durationMinutes,
    adminMode,
  });

  if (rejection === "overlap") {
    return {
      ok: false,
      reason: "Sorry, that time slot was just taken — please pick another time.",
    };
  }
  if (rejection === "closing") {
    return { ok: false, reason: "There isn't enough time before closing." };
  }
  if (rejection === "closed-segment") {
    return { ok: false, reason: "This time slot is no longer available." };
  }

  return { ok: true };
}
