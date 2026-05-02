"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

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
};

const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function generateSlots(): string[] {
  const out: string[] = [];
  let m = 9 * 60 + 30;
  const end = 19 * 60;
  while (m <= end) {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    out.push(`${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`);
    m += 30;
  }
  return out;
}
const SLOTS = generateSlots();

function normalize(t: string): string {
  return t.length === 5 ? `${t}:00` : t;
}

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
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [, setRefreshTick] = useState(0);

  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));

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

  const bookingsByDate = useMemo(() => {
    const out: Record<string, Record<string, string>> = {};
    for (const b of bookings) {
      const date = b.booking_date;
      const time = String(b.booking_time).slice(0, 5);
      if (!out[date]) out[date] = {};
      out[date][time] = b.customer_first_name;
    }
    return out;
  }, [bookings]);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  function shiftWeek(delta: number) {
    setWeekStart((prev) => addDays(prev, delta * 7));
  }
  function thisWeek() {
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

  // Toggle whole day on/off. We use blocked_dates as the date-specific
  // off switch — toggling off blocks the date, toggling on unblocks it.
  // (Slot-level state still lives in slot_overrides + the day_of_week pattern.)
  async function toggleDay(date: Date) {
    const iso = isoDate(date);
    const wasBlocked = blockedSet.has(iso);
    if (wasBlocked) {
      // Unblock.
      blockedSet.delete(iso);
      setRefreshTick((n) => n + 1);
      const blockedRow = blocked.find((b) => b.blocked_date === iso);
      if (blockedRow) {
        await fetch("/api/admin/availability/unblock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: blockedRow.id }),
        });
      }
    } else {
      // Block the date so it disappears from public availability.
      blockedSet.add(iso);
      setRefreshTick((n) => n + 1);
      await fetch("/api/admin/availability/block", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: iso }),
      });
    }
    startTransition(() => router.refresh());
  }

  // Toggle a specific slot on a specific date via slot_overrides.
  async function toggleSlot(date: Date, slot: string, currentlyActive: boolean) {
    const iso = isoDate(date);
    const next = !currentlyActive;
    if (!overrideMap[iso]) overrideMap[iso] = {};
    overrideMap[iso][slot] = next;
    setRefreshTick((n) => n + 1);
    try {
      await fetch("/api/admin/availability/slot-override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          override_date: iso,
          slot_time: normalize(slot),
          is_active: next,
        }),
      });
      startTransition(() => router.refresh());
    } catch {
      overrideMap[iso][slot] = currentlyActive;
      setRefreshTick((n) => n + 1);
    }
  }

  // Block-date form state (separate manual blocking, e.g. for far-future
  // dates not visible in the current week view).
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [blockError, setBlockError] = useState<string | null>(null);

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

  const openDays = weekDays.filter((d) => isDayOpen(isoDate(d), d.getDay()));

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
      <div className="avail-day-row">
        {weekDays.map((d) => {
          const iso = isoDate(d);
          const dow = d.getDay();
          const open = isDayOpen(iso, dow);
          return (
            <button
              key={iso}
              type="button"
              className={`avail-day-btn${open ? " is-selected" : ""}`}
              onClick={() => toggleDay(d)}
              aria-pressed={open}
              disabled={pending}
            >
              <span className="avail-day-name">{DAYS_SHORT[dow]}</span>
              <span className="avail-day-date">
                {d.getDate()} {MONTHS_SHORT[d.getMonth()]}
              </span>
            </button>
          );
        })}
      </div>

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
                  const bookedBy = dayBookings[slot];
                  if (bookedBy) {
                    return (
                      <div
                        key={slot}
                        className="avail-slot is-booked"
                        title={`Booked by ${bookedBy}`}
                      >
                        <span className="avail-slot-time">{slot}</span>
                        <span className="avail-slot-tag">
                          Booked · {bookedBy}
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

      {blocked.length === 0 ? (
        <div className="admin-card">No blocked dates.</div>
      ) : (
        <ul className="blocked-list">
          {blocked.map((b) => (
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
  );
}
