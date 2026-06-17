"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { durationMinutesForTreatmentId } from "@/lib/services";
import { BUFFER_MINUTES } from "@/lib/availability";
import { ukTodayIso } from "@/lib/uk-time";

type AvailabilityRow = {
  id: string;
  day_of_week: number;
  slot_time: string;
  is_active: boolean;
};

type BlockedRow = {
  id: string;
  blocked_date: string;
  reason: string | null;
};

type BookingRow = {
  id: string;
  booking_date: string;
  booking_time: string;
  duration_minutes: number | null;
  treatment_id: string;
  customer_first_name: string;
  status: "pending" | "confirmed" | "cancelled";
};

type SlotOverrideRow = {
  override_date: string;
  slot_time: string;
  is_active: boolean;
};

type Props = {
  availability: AvailabilityRow[];
  blocked: BlockedRow[];
  bookings: BookingRow[];
  overrides: SlotOverrideRow[];
  // Last date the server fetched data for (today + HORIZON_DAYS, YYYY-MM-DD).
  // Week navigation is capped to this so every reachable date is inside the
  // fetched window — otherwise far-future toggles save but never re-read,
  // flashing green then reverting.
  horizonIso: string;
};

const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// 15-minute grid, 09:30 through 18:45 inclusive — 18:45 is the last occupiable
// segment (19:00 is closing time, never a start). ~38 cells per day.
function generateSlots(): string[] {
  const out: string[] = [];
  let m = 9 * 60 + 30;
  const end = 18 * 60 + 45;
  while (m <= end) {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    out.push(`${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`);
    m += 15;
  }
  return out;
}
const SLOTS = generateSlots();

function normalize(t: string): string {
  return t.length === 5 ? `${t}:00` : t;
}

function timeToMin(t: string): number {
  const [h, m] = String(t).slice(0, 5).split(":");
  return parseInt(h, 10) * 60 + parseInt(m, 10);
}

function minToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Past-date hiding uses ukTodayIso() from @/lib/uk-time (Europe/London,
// regardless of the admin's own timezone).

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

// Monday as first day of week.
function startOfWeek(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  const dow = out.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  out.setDate(out.getDate() + diff);
  return out;
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

// Parse a YYYY-MM-DD into a LOCAL Date (midnight local), matching isoDate()'s
// local-calendar basis so horizon comparisons line up with the rendered week.
function parseIsoLocal(iso: string): Date {
  const [y, m, d] = iso.split("-").map((s) => parseInt(s, 10));
  return new Date(y, m - 1, d);
}

function formatLong(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function formatBlockedDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function AvailabilityPanel({
  availability,
  blocked,
  bookings,
  overrides,
  horizonIso,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [, setRefreshTick] = useState(0);
  // Surfaced when an optimistic toggle's save fails, so a genuine server error
  // is distinguishable from success (the bug was: fetch doesn't reject on a
  // 500, so a failed save silently flashed green then reverted on refresh).
  const [toggleError, setToggleError] = useState<string | null>(null);
  // Set to a "D Mon" label when the admin taps a beyond-horizon ("Soon") day,
  // so the dead tap is explained rather than reading as a bug.
  const [beyondHint, setBeyondHint] = useState<string | null>(null);

  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));

  // Today (Europe/London). Past days are greyed out and inert — the studio
  // can't open or edit slots for dates that have already gone.
  const todayIso = ukTodayIso();

  // Latest week the admin may navigate to: the week containing the horizon.
  // Beyond it, dates fall outside the fetched window and can't be managed.
  const maxWeekStart = useMemo(
    () => startOfWeek(parseIsoLocal(horizonIso)),
    [horizonIso]
  );
  const maxWeekStartIso = isoDate(maxWeekStart);
  const atHorizonEdge = isoDate(weekStart) >= maxWeekStartIso;

  // Recurring weekly template — used as the default for any date that
  // doesn't have explicit slot overrides.
  const dayPattern = useMemo(() => {
    const m: Record<number, Set<string>> = {};
    for (const a of availability) {
      if (!a.is_active) continue;
      const dow = a.day_of_week;
      if (!m[dow]) m[dow] = new Set();
      m[dow].add(String(a.slot_time).slice(0, 5));
    }
    return m;
  }, [availability]);

  // Mutable optimistic stores keyed by ISO date.
  const blockedSet = useMemo(
    () => new Set(blocked.map((b) => b.blocked_date)),
    [blocked]
  );
  // Map: date → { time → is_active }
  const overrideMap = useMemo(() => {
    const m: Record<string, Record<string, boolean>> = {};
    for (const o of overrides) {
      const d = o.override_date;
      const t = String(o.slot_time).slice(0, 5);
      if (!m[d]) m[d] = {};
      m[d][t] = o.is_active;
    }
    return m;
  }, [overrides]);

  // A booking now spans every 15-min segment of its session [start, start+dur),
  // plus its trailing buffer segments [start+dur, start+dur+15) shown in a
  // lighter style. Session marking takes priority over buffer.
  const bookingsByDate = useMemo(() => {
    type Seg = { name: string; kind: "session" | "buffer" };
    const out: Record<string, Record<string, Seg>> = {};
    for (const b of bookings) {
      const date = b.booking_date;
      const startMin = timeToMin(b.booking_time);
      const dur =
        b.duration_minutes ??
        durationMinutesForTreatmentId(b.treatment_id) ??
        60;
      if (!out[date]) out[date] = {};
      const day = out[date];
      // Buffer first (lower priority).
      for (let m = startMin + dur; m < startMin + dur + BUFFER_MINUTES; m += 15) {
        const t = minToTime(m);
        if (!day[t]) day[t] = { name: b.customer_first_name, kind: "buffer" };
      }
      // Session segments override any buffer mark.
      for (let m = startMin; m < startMin + dur; m += 15) {
        day[minToTime(m)] = { name: b.customer_first_name, kind: "session" };
      }
    }
    return out;
  }, [bookings]);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  function shiftWeek(delta: number) {
    setBeyondHint(null);
    // Clamp both edges: the current week is the earliest reachable (past weeks
    // are inert), and the horizon week is the latest (beyond it, dates are
    // outside the fetched window and toggles couldn't reconcile on refresh).
    setWeekStart((prev) => {
      const next = addDays(prev, delta * 7);
      const currentStart = startOfWeek(new Date());
      if (next < currentStart) return prev;
      if (isoDate(next) > maxWeekStartIso) return prev;
      return next;
    });
  }
  function thisWeek() {
    setBeyondHint(null);
    setWeekStart(startOfWeek(new Date()));
  }

  // Resolve a date's active slots: pattern ∪ overrides(true), minus overrides(false).
  function activeSlotsFor(iso: string, dow: number): Set<string> {
    const base = new Set(dayPattern[dow] ?? []);
    const ov = overrideMap[iso] ?? {};
    for (const [time, active] of Object.entries(ov)) {
      if (active) base.add(time);
      else base.delete(time);
    }
    return base;
  }

  function isDayOpen(iso: string, dow: number): boolean {
    if (blockedSet.has(iso)) return false;
    return activeSlotsFor(iso, dow).size > 0;
  }

  // Toggle whole day on/off. The "off" state is stored in blocked_dates;
  // the "on" state is "not blocked AND there are slots". For Mon/Sun (no
  // day_of_week template by default) toggling on also seeds the full
  // 09:30–19:00 slot list as active overrides for that specific date so
  // the day actually has slots to show.
  // fetch() only rejects on a network error, not on an HTTP 4xx/5xx — so a
  // failed save must be detected via res.ok, otherwise the optimistic green
  // state survives until router.refresh() silently reverts it.
  async function postOk(url: string, payload: unknown): Promise<boolean> {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async function toggleDay(date: Date) {
    const iso = isoDate(date);
    if (iso < todayIso || iso > horizonIso) return; // past / beyond-horizon are inert
    const dow = date.getDay();
    const currentlyOpen = isDayOpen(iso, dow);
    setToggleError(null);
    setBeyondHint(null);

    if (currentlyOpen) {
      // Close the day — block this specific date.
      blockedSet.add(iso);
      setRefreshTick((n) => n + 1);
      const ok = await postOk("/api/admin/availability/block", { date: iso });
      if (!ok) {
        blockedSet.delete(iso); // roll back
        setRefreshTick((n) => n + 1);
        setToggleError("Couldn't close that day — please try again.");
        return;
      }
    } else {
      // Open the day. First unblock if blocked.
      if (blockedSet.has(iso)) {
        blockedSet.delete(iso);
        setRefreshTick((n) => n + 1);
        const blockedRow = blocked.find((b) => b.blocked_date === iso);
        if (blockedRow) {
          const ok = await postOk("/api/admin/availability/unblock", {
            id: blockedRow.id,
          });
          if (!ok) {
            blockedSet.add(iso); // roll back
            setRefreshTick((n) => n + 1);
            setToggleError("Couldn't open that day — please try again.");
            return;
          }
        }
      }

      // If the day has no template and no resolved slots, seed all default
      // slots as active overrides so the day actually shows slots to
      // customers and to the slot grid below.
      const baseSlots = dayPattern[dow] ?? new Set<string>();
      const existingOv = overrideMap[iso] ?? {};
      const resolved = new Set(baseSlots);
      for (const [time, active] of Object.entries(existingOv)) {
        if (active) resolved.add(time);
        else resolved.delete(time);
      }
      if (resolved.size === 0) {
        const seedRows = SLOTS.map((s) => ({ slot_time: s, is_active: true }));
        // Reflect optimistically in the local map.
        const hadEntry = !!overrideMap[iso];
        if (!overrideMap[iso]) overrideMap[iso] = {};
        for (const s of SLOTS) overrideMap[iso][s] = true;
        setRefreshTick((n) => n + 1);
        const ok = await postOk("/api/admin/availability/slot-override-bulk", {
          override_date: iso,
          slots: seedRows,
        });
        if (!ok) {
          // Roll back the optimistic seed (any prior unblock has persisted, so
          // the day simply returns to closed — its real state).
          if (hadEntry) for (const s of SLOTS) delete overrideMap[iso][s];
          else delete overrideMap[iso];
          setRefreshTick((n) => n + 1);
          setToggleError("Couldn't open that day — please try again.");
          return;
        }
      }
    }
    startTransition(() => router.refresh());
  }

  // Toggle a specific slot on a specific date via slot_overrides.
  async function toggleSlot(date: Date, slot: string, currentlyActive: boolean) {
    const iso = isoDate(date);
    if (iso < todayIso || iso > horizonIso) return; // past / beyond-horizon are inert
    const next = !currentlyActive;
    if (!overrideMap[iso]) overrideMap[iso] = {};
    const hadEntry = slot in overrideMap[iso];
    const prevVal = overrideMap[iso][slot];
    overrideMap[iso][slot] = next;
    setRefreshTick((n) => n + 1);
    setToggleError(null);

    const ok = await postOk("/api/admin/availability/slot-override", {
      override_date: iso,
      slot_time: normalize(slot),
      is_active: next,
    });
    if (ok) {
      startTransition(() => router.refresh());
    } else {
      // Roll back to the slot's exact prior state (which may be "no override").
      if (hadEntry) overrideMap[iso][slot] = prevVal;
      else delete overrideMap[iso][slot];
      setRefreshTick((n) => n + 1);
      setToggleError("Couldn't update that slot — please try again.");
    }
  }

  // Block-date form state (separate manual blocking, e.g. for far-future
  // dates not visible in the current week view).
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [blockError, setBlockError] = useState<string | null>(null);
  const [blockedExpanded, setBlockedExpanded] = useState(false);

  // Only show today-or-future blocked dates — past closures are noise.
  const visibleBlocked = useMemo(() => {
    const todayIso = ukTodayIso();
    return blocked.filter((b) => b.blocked_date >= todayIso);
  }, [blocked]);
  // Collapse a long list by default so the page isn't an endless scroll.
  const blockedCollapsible = visibleBlocked.length > 5;
  const showBlockedList = !blockedCollapsible || blockedExpanded;

  async function block(e: React.FormEvent) {
    e.preventDefault();
    setBlockError(null);
    const res = await fetch("/api/admin/availability/block", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, reason: reason.trim() || undefined }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setBlockError(body.error ?? "Could not block this date.");
      return;
    }
    setDate("");
    setReason("");
    startTransition(() => router.refresh());
  }

  async function unblock(id: string) {
    const res = await fetch("/api/admin/availability/unblock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) startTransition(() => router.refresh());
  }

  const weekHeader = `Week of ${weekStart.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "long",
  })}`;

  // Open days within the managed window — past and beyond-horizon days never
  // show an editable grid (their data isn't fetched, so they can't reconcile).
  const openDays = weekDays.filter((d) => {
    const iso = isoDate(d);
    return iso >= todayIso && iso <= horizonIso && isDayOpen(iso, d.getDay());
  });

  return (
    <>
      {/* Week selector */}
      <div className="avail-week-bar">
        <div className="avail-week-label">{weekHeader}</div>
        <div className="avail-week-nav">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => shiftWeek(-1)}
          >
            ← Previous
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={thisWeek}
          >
            This week
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => shiftWeek(1)}
            disabled={atHorizonEdge}
            title={
              atHorizonEdge
                ? "You can manage availability up to about 8 weeks ahead."
                : undefined
            }
          >
            Next →
          </button>
        </div>
      </div>

      {/* Day toggles */}
      <p className="lede" style={{ marginBottom: 10 }}>
        Tick the days the studio is open this week. Each open day reveals its
        slots below for fine-tuning.
      </p>
      {toggleError && (
        <div className="error-text" style={{ marginBottom: 10 }}>
          {toggleError}
        </div>
      )}
      <div className="avail-day-row">
        {weekDays.map((d) => {
          const iso = isoDate(d);
          const dow = d.getDay();
          const open = isDayOpen(iso, dow);
          // Two distinct inert reasons, styled differently so the rolling
          // end-of-window day never reads as a broken button:
          //   - past days: flat-dimmed and truly disabled;
          //   - beyond-horizon days: a "Soon" lock state that, when tapped,
          //     explains the ~8-week window instead of doing nothing.
          const isPast = iso < todayIso;
          const isBeyond = iso > horizonIso;
          return (
            <button
              key={iso}
              type="button"
              className={`avail-day-btn${open ? " is-selected" : ""}${
                isPast ? " is-past" : ""
              }${isBeyond ? " is-beyond" : ""}`}
              onClick={() => {
                if (isBeyond) {
                  // toggleDay no-ops beyond the horizon anyway; surface why.
                  setBeyondHint(`${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`);
                  return;
                }
                toggleDay(d);
              }}
              aria-pressed={isBeyond ? undefined : open}
              aria-label={
                isBeyond
                  ? `${DAYS_SHORT[dow]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} — not yet available, about 8 weeks ahead`
                  : undefined
              }
              disabled={isPast || pending}
            >
              <span className="avail-day-name">{DAYS_SHORT[dow]}</span>
              <span className="avail-day-date">
                {d.getDate()} {MONTHS_SHORT[d.getMonth()]}
              </span>
              {isBeyond && <span className="avail-day-soon">Soon</span>}
            </button>
          );
        })}
      </div>
      {beyondHint && (
        <div className="avail-edge-hint" role="status">
          <strong>{beyondHint} isn&apos;t open to manage yet.</strong> You can set
          availability about 8 weeks ahead — this day becomes editable as that
          window rolls forward.
        </div>
      )}

      {/* One slot grid per active day */}
      {openDays.length === 0 ? (
        <div className="admin-card" style={{ marginBottom: 18 }}>
          No open days this week. Tap a day above to mark the studio open.
        </div>
      ) : (
        openDays.map((d) => {
          const iso = isoDate(d);
          const dow = d.getDay();
          const activeSet = activeSlotsFor(iso, dow);
          const dayBookings = bookingsByDate[iso] ?? {};
          return (
            <section key={iso} className="avail-day-detail">
              <h2 style={{ marginBottom: 6 }}>{formatLong(d)}</h2>
              <p className="lede" style={{ marginBottom: 14 }}>
                Sage = visible to public. Grey outline = hidden. Booked slots
                can&apos;t be toggled.
              </p>
              <div className="avail-slot-grid">
                {SLOTS.map((slot) => {
                  const seg = dayBookings[slot];
                  if (seg) {
                    const isBuffer = seg.kind === "buffer";
                    return (
                      <div
                        key={slot}
                        className={`avail-slot is-booked${
                          isBuffer ? " is-buffer" : ""
                        }`}
                        title={
                          isBuffer
                            ? `Buffer after ${seg.name}`
                            : `Booked by ${seg.name}`
                        }
                      >
                        <span className="avail-slot-time">{slot}</span>
                        <span className="avail-slot-tag">
                          {isBuffer ? "Buffer" : `Booked · ${seg.name}`}
                        </span>
                      </div>
                    );
                  }
                  const active = activeSet.has(slot);
                  return (
                    <button
                      key={slot}
                      type="button"
                      className={`avail-slot${active ? " is-active" : ""}`}
                      onClick={() => toggleSlot(d, slot, active)}
                      aria-pressed={active}
                      disabled={pending}
                    >
                      <span className="avail-slot-time">{slot}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })
      )}

      {/* Blocked dates */}
      <h2 style={{ marginTop: 36, marginBottom: 14 }}>Block specific dates</h2>
      <p className="lede">
        Toggling a day off above already adds it here. Use this form for dates
        outside the visible week (holidays, training days, etc.).
      </p>

      <form onSubmit={block} className="admin-card" style={{ marginBottom: 16 }}>
        {blockError && <div className="error-text">{blockError}</div>}
        <div className="avail-block-grid">
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="block-date">Date</label>
            <input
              id="block-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="block-reason">Reason (optional)</label>
            <input
              id="block-reason"
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Annual leave"
            />
          </div>
          <button type="submit" className="btn" disabled={!date || pending}>
            Block this date
          </button>
        </div>
      </form>

      {visibleBlocked.length === 0 ? (
        <div className="admin-card">No blocked dates.</div>
      ) : (
        <>
          {blockedCollapsible && (
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => setBlockedExpanded((v) => !v)}
              style={{ marginBottom: 12 }}
            >
              {visibleBlocked.length} blocked dates —{" "}
              {blockedExpanded ? "hide" : "show"}
            </button>
          )}
          {showBlockedList && (
            <ul className="blocked-list">
              {visibleBlocked.map((b) => (
                <li key={b.id}>
                  <span>
                    <strong>{formatBlockedDate(b.blocked_date)}</strong>
                    {b.reason ? (
                      <span style={{ opacity: 0.65, marginLeft: 10 }}>
                        · {b.reason}
                      </span>
                    ) : null}
                  </span>
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    onClick={() => unblock(b.id)}
                    disabled={pending}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </>
  );
}
