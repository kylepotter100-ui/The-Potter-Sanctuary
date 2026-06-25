"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  validStartTimes,
  candidateRejection,
  type ExistingBooking,
} from "@/lib/availability";
import { ukNow } from "@/lib/uk-time";

type Props = {
  bookingId: string;
  treatmentName: string;
  durationMinutes: number;
  currentDateLabel: string;
  currentTime: string; // HH:MM
};

type AvailabilityData = {
  slotsByDay: Record<number, string[]>;
  blockedDates: string[];
  bookedSlots: Record<string, { time: string; duration: number }[]>;
  slotOverrides?: Record<string, Record<string, boolean>>;
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DOWS = ["S", "M", "T", "W", "T", "F", "S"];

function startOfDay(d: Date) {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}
function isoDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}
function longDate(d: Date) {
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}
function minToTime(min: number) {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(
    min % 60
  ).padStart(2, "0")}`;
}
function timeToMin(t: string) {
  const [h, m] = t.slice(0, 5).split(":");
  return parseInt(h, 10) * 60 + parseInt(m, 10);
}

// Owner reschedule — same calendar + availability picker as admin "New
// booking" (mb-* styling), including the "book anytime" toggle. Moves the
// booking via the admin reschedule route and emails the client. A genuine
// clash with another appointment is still blocked server-side + by the DB
// exclusion constraint.
export default function AdminRescheduleBooking({
  bookingId,
  treatmentName,
  durationMinutes,
  currentDateLabel,
  currentTime,
}: Props) {
  const router = useRouter();
  const today = useMemo(() => startOfDay(new Date()), []);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [date, setDate] = useState<Date | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [bookAnytime, setBookAnytime] = useState(false);
  const [availability, setAvailability] = useState<AvailabilityData | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/availability", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: AvailabilityData | null) => {
        if (!cancelled && d) setAvailability(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const blockedSet = useMemo(
    () => new Set(availability?.blockedDates ?? []),
    [availability]
  );
  const bookedByDate = useMemo(
    () => availability?.bookedSlots ?? {},
    [availability]
  );
  const overridesByDate = useMemo(
    () => availability?.slotOverrides ?? {},
    [availability]
  );

  function existingFor(dt: Date): ExistingBooking[] {
    return (bookedByDate[isoDate(dt)] ?? []).map((b) => ({
      time: b.time,
      duration_minutes: b.duration,
    }));
  }
  function openSetFor(dt: Date): Set<string> {
    const set = new Set(availability?.slotsByDay[dt.getDay()] ?? []);
    const ov = overridesByDate[isoDate(dt)] ?? {};
    for (const [t, active] of Object.entries(ov)) {
      if (active) set.add(t);
      else set.delete(t);
    }
    return set;
  }
  function freeSlotsFor(dt: Date): string[] {
    if (!availability) return [];
    const iso = isoDate(dt);
    const existing = existingFor(dt);

    if (bookAnytime) {
      // Full-day 15-min grid; only the overlap check applies (admin mode).
      const out: string[] = [];
      for (let m = 0; m + durationMinutes <= 24 * 60; m += 15) {
        const start = minToTime(m);
        const rej = candidateRejection({
          openSet: new Set(),
          existing,
          start,
          duration: durationMinutes,
          adminMode: true,
        });
        if (rej === null) out.push(start);
      }
      return out;
    }

    if (blockedSet.has(iso)) return [];
    let slots = validStartTimes(openSetFor(dt), existing, durationMinutes);
    const { dateIso: ukToday, minutes: ukMinutes } = ukNow();
    if (iso === ukToday) {
      const cutoff = ukMinutes + 15;
      slots = slots.filter((t) => timeToMin(t) >= cutoff);
    }
    return slots;
  }

  const calCells = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const startDow = first.getDay();
    const days = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: Array<{
      key: string;
      label: number;
      date: Date | null;
      disabled: boolean;
      selected: boolean;
    }> = [];
    for (let i = 0; i < startDow; i++)
      cells.push({ key: `b-${i}`, label: 0, date: null, disabled: true, selected: false });
    for (let d = 1; d <= days; d++) {
      const dt = new Date(viewYear, viewMonth, d);
      const isPast = dt < today;
      const noSlots = availability
        ? freeSlotsFor(dt).length === 0
        : dt.getDay() === 0 || dt.getDay() === 1;
      cells.push({
        key: `d-${d}`,
        label: d,
        date: dt,
        disabled: isPast || noSlots,
        selected: !!date && dt.getTime() === date.getTime(),
      });
    }
    return cells;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewYear, viewMonth, today, date, availability, bookAnytime, blockedSet, bookedByDate, overridesByDate]);

  const slots = useMemo(() => {
    if (!date || !availability) return [];
    return freeSlotsFor(date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, availability, bookAnytime, blockedSet, bookedByDate, overridesByDate]);

  function shiftMonth(delta: number) {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) { m = 11; y -= 1; }
    else if (m > 11) { m = 0; y += 1; }
    setViewMonth(m);
    setViewYear(y);
  }

  async function submit() {
    if (!date || !time) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: isoDate(date), time }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          message?: string;
          error?: string;
        } | null;
        throw new Error(body?.message || body?.error || "Could not reschedule");
      }
      router.push(`/admin/bookings/${bookingId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reschedule");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="admin-card">
      <p className="lede" style={{ marginTop: 0 }}>
        Currently booked: <strong>{treatmentName}</strong> · {currentDateLabel} ·{" "}
        {currentTime}. Pick a new date and time, then confirm — the client is
        emailed a reschedule confirmation.
      </p>

      <div className="mb-twocol">
        <div>
          <div className="mb-cal-head">
            <span className="mb-cal-month">
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <span className="mb-cal-nav">
              <button type="button" aria-label="Previous month" onClick={() => shiftMonth(-1)}>‹</button>
              <button type="button" aria-label="Next month" onClick={() => shiftMonth(1)}>›</button>
            </span>
          </div>
          <div className="mb-cal">
            {DOWS.map((d, i) => (
              <div className="mb-dow" key={`dow-${i}`}>{d}</div>
            ))}
            {calCells.map((c) => (
              <div
                key={c.key}
                className={`mb-day${!c.date ? " blank" : ""}${c.disabled ? " off" : " in"}${c.selected ? " sel" : ""}`}
                onClick={() => {
                  if (c.disabled || !c.date) return;
                  setDate(c.date);
                  setTime(null);
                }}
              >
                {c.label > 0 ? c.label : ""}
              </div>
            ))}
          </div>
          <label className="mb-anytime">
            <input
              type="checkbox"
              checked={bookAnytime}
              onChange={(e) => {
                setBookAnytime(e.target.checked);
                setTime(null);
              }}
            />
            Book anytime — unlock every day &amp; time (clashes still blocked)
          </label>
        </div>
        <div>
          <p className="mb-slots-h">
            {date ? `Times for ${longDate(date)}` : "Select a date to see times"}
          </p>
          {date && slots.length === 0 && (
            <p className="lede" style={{ margin: 0 }}>
              No available times on this day.
            </p>
          )}
          <div className="mb-slots">
            {slots.map((t) => {
              const offHours =
                timeToMin(t) < timeToMin("09:30") || timeToMin(t) > timeToMin("18:45");
              return (
                <button
                  key={t}
                  type="button"
                  className={`mb-slot${time === t ? " sel" : ""}${bookAnytime && offHours ? " off-hours" : ""}`}
                  onClick={() => setTime(t)}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" className="modal-error" style={{ marginTop: 12 }}>
          {error}
        </div>
      )}

      <div className="mb-actions">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => router.push(`/admin/bookings/${bookingId}`)}
        >
          ← Cancel
        </button>
        <button
          type="button"
          className="btn"
          disabled={!date || !time || submitting}
          onClick={submit}
        >
          {submitting ? "Rescheduling…" : "Confirm new time"}
        </button>
      </div>
    </div>
  );
}
