import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Documents the timezone bug class found in the booking-path audit.
//
// Bookings store a calendar date + UK wall-clock time with NO timezone
// (`booking_date` date + `booking_time` time). Server code (Cloudflare
// Workers, runtime TZ = UTC) parsed them with
//
//     new Date(`${booking_date}T${booking_time}`)
//
// which treats the wall-clock string as UTC. During BST (late March → late
// October) UK wall time is UTC+1, so the parsed instant is ONE HOUR LATER
// than the real appointment. Consequences before the fix:
//   - the 15-minute cancel cutoff engaged an hour late (cancellable up to
//     45 minutes INTO the appointment),
//   - cron reminder windows drifted by an hour.
//
// These tests pin the facts the fix (lib/uk-time.ts) is built on. The
// "naive parse on a UTC server" is modelled with an explicit Z suffix so the
// test is deterministic on any machine, exactly matching workerd behaviour.
// ---------------------------------------------------------------------------

function naiveUtcParse(dateIso: string, hhmm: string): Date {
  return new Date(`${dateIso}T${hhmm}:00Z`);
}

// Independent reference: the true UTC instant of a Europe/London wall time,
// using hard-coded, externally verifiable offsets (BST = UTC+1 from the last
// Sunday of March to the last Sunday of October; GMT = UTC+0 otherwise).
const HOUR = 60 * 60 * 1000;

describe("documented bug: Z-less wall-time parse on a UTC server", () => {
  it("is exactly 1 hour late for a summer (BST) booking", () => {
    // 14:00 UK on 2026-06-15 (BST) is truly 13:00 UTC.
    const trueInstant = Date.UTC(2026, 5, 15, 13, 0);
    const parsed = naiveUtcParse("2026-06-15", "14:00").getTime();
    expect(parsed - trueInstant).toBe(HOUR);
  });

  it("is correct for a winter (GMT) booking — bug hides half the year", () => {
    // 14:00 UK on 2026-01-15 (GMT) is truly 14:00 UTC.
    const trueInstant = Date.UTC(2026, 0, 15, 14, 0);
    const parsed = naiveUtcParse("2026-01-15", "14:00").getTime();
    expect(parsed - trueInstant).toBe(0);
  });

  it("UTC 'today' lags the UK calendar day during BST evenings", () => {
    // 2026-06-15T23:30Z is already 00:30 on the 16th in the UK.
    const at = new Date(Date.UTC(2026, 5, 15, 23, 30));
    const utcToday = at.toISOString().slice(0, 10);
    const ukToday = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/London",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(at);
    expect(utcToday).toBe("2026-06-15");
    expect(ukToday).toBe("2026-06-16");
  });
});
