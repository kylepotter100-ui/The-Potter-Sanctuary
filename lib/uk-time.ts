// ============================================================================
// Europe/London time helpers — the single source of truth for "UK now" and
// for converting stored booking wall-times into real instants.
//
// WHY THIS EXISTS: bookings store a calendar date + UK wall-clock time with no
// timezone (`booking_date` date, `booking_time` time). The server runtime
// (Cloudflare Workers) is UTC, so `new Date(`${date}T${time}`)` silently
// treats UK wall time as UTC — one hour late for the whole of BST. That broke
// the 15-minute cancel cutoff and drifted every cron window in summer
// (see tests/dst-bug-reproduction.test.ts). NEVER parse a booking's
// date+time with bare `new Date(...)` — use ukWallTimeToUtc().
//
// Pure functions, no dependencies, safe in server routes, client components
// and tests alike.
// ============================================================================

const UK_TZ = "Europe/London";

type UkParts = {
  year: number;
  month: number; // 1–12
  day: number; // 1–31
  hour: number; // 0–23
  minute: number; // 0–59
};

// Wall-clock parts a given instant shows in the UK. ("24" can appear at
// midnight in some engines — normalised to 0.)
function ukPartsAt(instant: Date): UkParts {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: UK_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(instant);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return {
    year: parseInt(get("year"), 10),
    month: parseInt(get("month"), 10),
    day: parseInt(get("day"), 10),
    hour: parseInt(get("hour"), 10) % 24,
    minute: parseInt(get("minute"), 10),
  };
}

/** Today's date (YYYY-MM-DD) in Europe/London, regardless of runtime TZ. */
export function ukTodayIso(): string {
  const p = ukPartsAt(new Date());
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** Minutes since UK midnight, right now. */
export function ukNowMinutes(): number {
  const p = ukPartsAt(new Date());
  return p.hour * 60 + p.minute;
}

/**
 * Current UK date (YYYY-MM-DD) and minutes-since-midnight together — the shape
 * the booking calendar uses to hide already-started slots on same-day views.
 */
export function ukNow(): { dateIso: string; minutes: number } {
  const p = ukPartsAt(new Date());
  return {
    dateIso: `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`,
    minutes: p.hour * 60 + p.minute,
  };
}

/** Current UK { year, month } — for "this month" defaults in the admin. */
export function ukYearMonth(): { year: number; month: number } {
  const p = ukPartsAt(new Date());
  return { year: p.year, month: p.month };
}

// The UK's UTC offset (minutes, +60 in BST / 0 in GMT) at a given instant:
// what UK wall clocks show, minus the instant itself.
function ukOffsetMinutesAt(instant: Date): number {
  const p = ukPartsAt(instant);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return Math.round((asUtc - instant.getTime()) / 60000);
}

/**
 * The real UTC instant of a Europe/London wall time — DST-aware, exact on
 * both transition days. `time` accepts "HH:MM" or "HH:MM:SS".
 *
 * Two-pass: guess the instant by reading the wall time as UTC, look up the
 * UK offset at that guess, subtract it, then re-check the offset at the
 * adjusted instant (the second pass only matters within an hour of a
 * transition). For the nonexistent spring-forward hour and the ambiguous
 * autumn hour this resolves deterministically (post-transition offset).
 */
export function ukWallTimeToUtc(dateIso: string, time: string): Date {
  const hhmm = String(time).slice(0, 5);
  const [hh, mm] = hhmm.split(":").map((s) => parseInt(s, 10));
  const [y, mo, d] = dateIso.split("-").map((s) => parseInt(s, 10));
  const guess = new Date(Date.UTC(y, mo - 1, d, hh, mm));
  let adjusted = new Date(guess.getTime() - ukOffsetMinutesAt(guess) * 60000);
  const secondOffset = ukOffsetMinutesAt(adjusted);
  adjusted = new Date(guess.getTime() - secondOffset * 60000);
  return adjusted;
}

/**
 * Minutes from `now` until a stored UK booking wall time. Negative once the
 * appointment has started. Used by the online-cancellation cutoff.
 */
export function minutesUntilUk(
  dateIso: string,
  time: string,
  now: Date = new Date()
): number {
  return (ukWallTimeToUtc(dateIso, time).getTime() - now.getTime()) / 60000;
}

/** dateIso + n days, as YYYY-MM-DD (calendar arithmetic, TZ-proof). */
export function addDaysIso(dateIso: string, days: number): string {
  const d = new Date(`${dateIso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
