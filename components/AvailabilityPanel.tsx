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

type Props = {
  availability: AvailabilityRow[];
  blocked: BlockedRow[];
  bookings: BookingRow[];
};

const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
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

// Monday as first day of week (en-GB convention).
function startOfWeek(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  const dow = out.getDay(); // 0=Sun .. 6=Sat
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
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [, setRefreshTick] = useState(0);

  const todayStart = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));
  const [selectedDate, setSelectedDate] = useState<Date | null>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });

  // Build a quick-lookup map for the weekly availability template.
  // Mutated optimistically when toggling — that's why we trigger refreshTick.
  const map = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const a of availability) {
      m.set(`${a.day_of_week}:${normalize(a.slot_time)}`, a.is_active);
    }
    return m;
  }, [availability]);

  // Map booking_date → { "HH:MM" → "first_name" }
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

  const blockedSet = useMemo(
    () => new Set(blocked.map((b) => b.blocked_date)),
    [blocked]
  );

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  function shiftWeek(delta: number) {
    setWeekStart((prev) => addDays(prev, delta * 7));
  }

  function thisWeek() {
    setWeekStart(startOfWeek(new Date()));
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    setSelectedDate(t);
  }

  async function toggleSlot(
    day: number,
    slot: string,
    currentlyActive: boolean
  ) {
    const next = !currentlyActive;
    map.set(`${day}:${normalize(slot)}`, next);
    setRefreshTick((n) => n + 1);
    try {
      await fetch("/api/admin/availability/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          day_of_week: day,
          slot_time: slot,
          is_active: next,
        }),
      });
      startTransition(() => router.refresh());
    } catch {
      map.set(`${day}:${normalize(slot)}`, currentlyActive);
      setRefreshTick((n) => n + 1);
    }
  }

  // Block-date form state.
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

  const selectedDow = selectedDate?.getDay();
  const selectedIso = selectedDate ? isoDate(selectedDate) : null;
  const selectedDayBookings =
    selectedIso && bookingsByDate[selectedIso] ? bookingsByDate[selectedIso] : {};
  const selectedDayBlocked = selectedIso ? blockedSet.has(selectedIso) : false;

  const weekHeader = `Week of ${weekStart.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "long",
  })}`;

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

      {/* Day-of-week buttons */}
      <div className="avail-day-row">
        {weekDays.map((d) => {
          const iso = isoDate(d);
          const isPast = d < todayStart;
          const isSelected = selectedIso === iso;
          return (
            <button
              key={iso}
              type="button"
              className={`avail-day-btn${isSelected ? " is-selected" : ""}${
                isPast ? " is-past" : ""
              }`}
              onClick={() => setSelectedDate(d)}
            >
              <span className="avail-day-name">{DAYS_SHORT[d.getDay()]}</span>
              <span className="avail-day-date">
                {d.getDate()} {MONTHS_SHORT[d.getMonth()]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Time slots for the selected day */}
      {selectedDate && selectedDow !== undefined && (
        <section className="avail-day-detail">
          <h2 style={{ marginBottom: 6 }}>
            Available slots for {formatLong(selectedDate)}
          </h2>
          {selectedDayBlocked && (
            <p className="error-text">
              This date is in your blocked dates list — slots will not appear
              to customers regardless of the toggles below.
            </p>
          )}
          <p className="lede" style={{ marginBottom: 14 }}>
            Sage = visible to public. Grey outline = hidden. Booked slots can&apos;t
            be toggled.
          </p>
          <div className="avail-slot-grid">
            {SLOTS.map((slot) => {
              const active = map.get(`${selectedDow}:${normalize(slot)}`) ?? false;
              const bookedBy = selectedDayBookings[slot];
              if (bookedBy) {
                return (
                  <div
                    key={slot}
                    className="avail-slot is-booked"
                    title={`Booked by ${bookedBy}`}
                  >
                    <span className="avail-slot-time">{slot}</span>
                    <span className="avail-slot-tag">Booked · {bookedBy}</span>
                  </div>
                );
              }
              return (
                <button
                  key={slot}
                  type="button"
                  className={`avail-slot${active ? " is-active" : ""}`}
                  onClick={() => toggleSlot(selectedDow, slot, active)}
                  disabled={pending}
                >
                  <span className="avail-slot-time">{slot}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Blocked dates */}
      <h2 style={{ marginTop: 36, marginBottom: 14 }}>Block specific dates</h2>
      <p className="lede">
        Holidays, training days, anything else. Blocked dates take precedence
        over the weekly grid.
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
