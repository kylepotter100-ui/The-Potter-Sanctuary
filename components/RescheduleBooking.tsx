"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { validStartTimes, type ExistingBooking } from "@/lib/availability";
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
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}
function slotToMinutes(t: string) {
  const [h, m] = t.slice(0, 5).split(":");
  return parseInt(h, 10) * 60 + parseInt(m, 10);
}

export default function RescheduleBooking({
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

  const blockedSet = useMemo(() => new Set(availability?.blockedDates ?? []), [availability]);
  const bookedByDate = useMemo(() => availability?.bookedSlots ?? {}, [availability]);
  const overridesByDate = useMemo(() => availability?.slotOverrides ?? {}, [availability]);

  function openSetFor(dt: Date): Set<string> {
    const set = new Set(availability?.slotsByDay[dt.getDay()] ?? []);
    const ov = overridesByDate[isoDate(dt)] ?? {};
    for (const [t, active] of Object.entries(ov)) {
      if (active) set.add(t);
      else set.delete(t);
    }
    return set;
  }
  function existingFor(dt: Date): ExistingBooking[] {
    return (bookedByDate[isoDate(dt)] ?? []).map((b) => ({ time: b.time, duration_minutes: b.duration }));
  }
  function freeSlotsFor(dt: Date): string[] {
    if (!availability) return [];
    const iso = isoDate(dt);
    if (blockedSet.has(iso)) return [];
    let slots = validStartTimes(openSetFor(dt), existingFor(dt), durationMinutes);
    const { dateIso: ukToday, minutes: ukMinutes } = ukNow();
    if (iso === ukToday) {
      const cutoff = ukMinutes + 15;
      slots = slots.filter((t) => slotToMinutes(t) >= cutoff);
    }
    return slots;
  }

  const calCells = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const startDow = first.getDay();
    const days = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: Array<{ key: string; label: number; date: Date | null; disabled: boolean; selected: boolean }> = [];
    for (let i = 0; i < startDow; i++) cells.push({ key: `b-${i}`, label: 0, date: null, disabled: true, selected: false });
    for (let d = 1; d <= days; d++) {
      const dt = new Date(viewYear, viewMonth, d);
      const isPast = dt < today;
      const noSlots = availability ? freeSlotsFor(dt).length === 0 : dt.getDay() === 0 || dt.getDay() === 1;
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
  }, [viewYear, viewMonth, today, date, availability, blockedSet, bookedByDate, overridesByDate]);

  const slots = useMemo(() => {
    if (!date || !availability) return [];
    return freeSlotsFor(date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, availability, blockedSet, bookedByDate, overridesByDate]);

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
      const res = await fetch(`/api/bookings/${bookingId}/reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: isoDate(date), time }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string; error?: string } | null;
        throw new Error(body?.message || body?.error || "Could not reschedule");
      }
      router.replace("/account?rescheduled=1");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reschedule");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="booking-card" style={{ marginTop: 8 }}>
      <div className="reschedule-current">
        Currently booked: <strong>{treatmentName}</strong> · {currentDateLabel} ·{" "}
        {currentTime}
      </div>
      <p className="hint" style={{ margin: "8px 0 16px" }}>
        Choose a new date and time, then confirm.
      </p>

      <div className="calendar">
        <div className="cal-pane">
          <div className="cal-head">
            <div className="month">{MONTHS[viewMonth]} {viewYear}</div>
            <div className="nav">
              <button type="button" aria-label="Previous month" onClick={() => shiftMonth(-1)}>‹</button>
              <button type="button" aria-label="Next month" onClick={() => shiftMonth(1)}>›</button>
            </div>
          </div>
          <div className="cal-grid">
            {DOWS.map((d, i) => (<div className="dow" key={`dow-${i}`}>{d}</div>))}
            {calCells.map((c) => (
              <div
                key={c.key}
                className={`day${!c.date ? " muted" : ""}${c.disabled ? " disabled" : ""}${c.selected ? " selected" : ""}`}
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
        </div>
        <div className="time-pane">
          <h4>Available times</h4>
          <div className="hint">{date ? longDate(date) : "Select a date to see times"}</div>
          <div className="slots">
            {date && availability && slots.length === 0 && (
              <div className="hint" style={{ gridColumn: "1 / -1" }}>No availability on this day.</div>
            )}
            {slots.map((t) => (
              <button
                key={t}
                type="button"
                className={`slot${time === t ? " active" : ""}`}
                onClick={() => setTime(t)}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {date && time && (
        <div className="selected-summary">
          <span className="l">New time</span>
          <span className="r">{longDate(date)} · {time}</span>
        </div>
      )}

      {error && (
        <div role="alert" className="modal-error" style={{ marginTop: 12 }}>{error}</div>
      )}

      <div className="step-actions" style={{ marginTop: 16 }}>
        <button type="button" className="back" onClick={() => router.push("/account")}>← Cancel</button>
        <button type="button" className="next" disabled={!date || !time || submitting} onClick={submit}>
          {submitting ? "Rescheduling…" : "Confirm new time →"}
        </button>
      </div>
    </div>
  );
}
