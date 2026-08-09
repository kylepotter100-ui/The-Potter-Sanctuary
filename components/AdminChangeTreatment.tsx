"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  candidateRejection,
  validStartTimes,
  type ExistingBooking,
} from "@/lib/availability";
import { services } from "@/lib/services";
import { ukNow } from "@/lib/uk-time";

type Props = {
  bookingId: string;
  currentTreatmentId: string;
  currentTreatmentName: string;
  currentPrice: number;
  currentDuration: number;
  currentDate: string; // YYYY-MM-DD
  currentTime: string; // HH:MM
  currentDateLabel: string;
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
function time12h(t: string): string {
  const [h, m] = t.slice(0, 5).split(":").map((s) => parseInt(s, 10));
  const suffix = h >= 12 ? "pm" : "am";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour}${suffix}` : `${hour}:${String(m).padStart(2, "0")}${suffix}`;
}

// Why a treatment doesn't fit, in the owner's language.
function reasonText(rej: "closing" | "overlap" | "closed-segment"): string {
  if (rej === "overlap") return "clashes with another booking";
  if (rej === "closing") return "runs past closing time";
  return "the studio is closed for part of it";
}

// Owner-side treatment change. The booking's own slot is excluded from the
// clash check (a booking can never clash with itself) — the (date, time) pair
// is unique among active bookings thanks to bookings_active_slot_unique, so
// matching on time is an exact self-match. A longer treatment that no longer
// fits reveals the date/time picker so both changes save together.
export default function AdminChangeTreatment({
  bookingId,
  currentTreatmentId,
  currentTreatmentName,
  currentPrice,
  currentDuration,
  currentDate,
  currentTime,
  currentDateLabel,
}: Props) {
  const router = useRouter();
  const today = useMemo(() => startOfDay(new Date()), []);
  const currentDateObj = useMemo(
    () => new Date(`${currentDate}T00:00:00`),
    [currentDate]
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewYear, setViewYear] = useState(currentDateObj.getFullYear());
  const [viewMonth, setViewMonth] = useState(currentDateObj.getMonth());
  const [date, setDate] = useState<Date | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [alsoMove, setAlsoMove] = useState(false);
  const [bookAnytime, setBookAnytime] = useState(false);
  const [availability, setAvailability] = useState<AvailabilityData | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
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

  // Every other booking that day — THIS booking is filtered out so it never
  // blocks its own slot.
  function existingFor(dt: Date): ExistingBooking[] {
    const iso = isoDate(dt);
    return (bookedByDate[iso] ?? [])
      .filter(
        (b) => !(iso === currentDate && b.time.slice(0, 5) === currentTime)
      )
      .map((b) => ({ time: b.time, duration_minutes: b.duration }));
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

  const selected = useMemo(
    () => services.find((s) => s.bookingId === selectedId) ?? null,
    [selectedId]
  );
  const selectedDuration = selected?.durationMinutes ?? currentDuration;

  // Fit of each treatment at the booking's EXISTING date/time.
  const fitByTreatment = useMemo(() => {
    const out = new Map<string, "closing" | "overlap" | "closed-segment" | null>();
    if (!availability) return out;
    const openSet = openSetFor(currentDateObj);
    const existing = existingFor(currentDateObj);
    for (const s of services) {
      out.set(
        s.bookingId,
        candidateRejection({
          openSet,
          existing,
          start: currentTime,
          duration: s.durationMinutes,
        })
      );
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availability, currentDateObj, currentTime, bookedByDate, overridesByDate]);

  const selectedRejection = selectedId ? fitByTreatment.get(selectedId) ?? null : null;
  const fitsAtCurrent = selectedId !== null && selectedRejection === null;
  const needsNewTime = selectedId !== null && !fitsAtCurrent && availability !== null;
  const showPicker = needsNewTime || alsoMove;

  function freeSlotsFor(dt: Date): string[] {
    if (!availability) return [];
    const iso = isoDate(dt);
    const existing = existingFor(dt);

    if (bookAnytime) {
      const out: string[] = [];
      for (let m = 0; m + selectedDuration <= 24 * 60; m += 15) {
        const start = minToTime(m);
        const rej = candidateRejection({
          openSet: new Set(),
          existing,
          start,
          duration: selectedDuration,
          adminMode: true,
        });
        if (rej === null) out.push(start);
      }
      return out;
    }

    if (blockedSet.has(iso)) return [];
    let slots = validStartTimes(openSetFor(dt), existing, selectedDuration);
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
      const noSlots = availability ? freeSlotsFor(dt).length === 0 : false;
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
  }, [viewYear, viewMonth, today, date, availability, bookAnytime, selectedDuration, blockedSet, bookedByDate, overridesByDate]);

  const slots = useMemo(() => {
    if (!date || !availability) return [];
    return freeSlotsFor(date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, availability, bookAnytime, selectedDuration, blockedSet, bookedByDate, overridesByDate]);

  function shiftMonth(delta: number) {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) { m = 11; y -= 1; }
    else if (m > 11) { m = 0; y += 1; }
    setViewMonth(m);
    setViewYear(y);
  }

  function pickTreatment(id: string) {
    setSelectedId(id);
    setError(null);
    setDate(null);
    setTime(null);
    setAlsoMove(false);
  }

  const movingTo = showPicker && date && time ? { date, time } : null;
  const canSave =
    !!selected &&
    selected.bookingId !== currentTreatmentId &&
    (fitsAtCurrent ? (!showPicker || !!movingTo) : !!movingTo);

  async function submit() {
    if (!selected || !canSave) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/treatment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          treatmentId: selected.bookingId,
          ...(movingTo
            ? { date: isoDate(movingTo.date), time: movingTo.time }
            : {}),
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          message?: string;
          error?: string;
        } | null;
        // A 409 means the picture changed under us — re-read availability so the
        // owner sees the truth before trying again.
        if (res.status === 409) {
          fetch("/api/availability", { cache: "no-store" })
            .then((r) => (r.ok ? r.json() : null))
            .then((d: AvailabilityData | null) => d && setAvailability(d))
            .catch(() => {});
          setTime(null);
        }
        throw new Error(
          body?.message || body?.error || "Could not change the treatment"
        );
      }
      setConfirmOpen(false);
      router.push(`/admin/bookings/${bookingId}`);
      router.refresh();
    } catch (err) {
      setConfirmOpen(false);
      setError(
        err instanceof Error ? err.message : "Could not change the treatment"
      );
    } finally {
      setSubmitting(false);
    }
  }

  const newWhenLabel = movingTo
    ? `${longDate(movingTo.date)} at ${time12h(movingTo.time)}`
    : `${currentDateLabel} at ${time12h(currentTime)}`;

  return (
    <>
      <div className="admin-card" style={{ marginBottom: 14 }}>
        <p className="admin-subheading">Currently</p>
        <div className="ct-current">
          <span className="ct-current-name">{currentTreatmentName}</span>
          <span className="ct-current-price">£{currentPrice}</span>
        </div>
        <div className="ct-meta">
          {currentDuration} min · {currentDateLabel} at {time12h(currentTime)}
        </div>
      </div>

      <p className="admin-subheading">New treatment</p>

      {!availability && (
        <p className="lede" style={{ marginTop: 0 }}>
          Checking availability…
        </p>
      )}

      {services.map((s, i) => {
        const isCurrent = s.bookingId === currentTreatmentId;
        const rej = fitByTreatment.get(s.bookingId) ?? null;
        const on = selectedId === s.bookingId;
        return (
          <button
            key={s.bookingId}
            type="button"
            className={`ct-opt${on ? " on" : ""}${isCurrent ? " current" : ""}`}
            onClick={() => !isCurrent && pickTreatment(s.bookingId)}
            disabled={isCurrent}
            aria-pressed={on}
          >
            <span className="ct-num">{String(i + 1).padStart(2, "0")}</span>
            <span className="ct-body">
              <span className="ct-name">
                {s.name} {s.nameEm}
              </span>
              <span className="ct-meta">
                {s.duration} · {s.pressure}
              </span>
              <span className="ct-fit">
                {isCurrent ? (
                  <span className="chip chip-cur">● Current treatment</span>
                ) : !availability ? null : rej === null ? (
                  <span className="chip chip-ok">
                    ✓ Fits at {time12h(currentTime)}
                  </span>
                ) : (
                  <>
                    <span className="chip chip-warn">⚠ Needs a new time</span>
                    <span className="ct-why">{reasonText(rej)}</span>
                  </>
                )}
              </span>
            </span>
            <span className="ct-price">{s.priceLabel}</span>
          </button>
        );
      })}

      {selected && (
        <>
          {needsNewTime && (
            <div className="ct-notice">
              <strong>
                {selected.name} {selected.nameEm} needs {selected.durationMinutes}{" "}
                minutes.
              </strong>{" "}
              It won&apos;t fit at {time12h(currentTime)} —{" "}
              {reasonText(selectedRejection ?? "overlap")}. Choose a new time
              below; both changes save together.
            </div>
          )}

          {fitsAtCurrent && !alsoMove && (
            <div className="info-text">
              The time doesn&apos;t need to change.{" "}
              <button
                type="button"
                className="ct-linkbtn"
                onClick={() => setAlsoMove(true)}
              >
                Change the time too
              </button>
            </div>
          )}

          {showPicker && (
            <div className="admin-card" style={{ marginBottom: 14 }}>
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
                    {date
                      ? `Times for ${longDate(date)} — fits ${selectedDuration} min`
                      : "Select a date to see times"}
                  </p>
                  {date && slots.length === 0 && (
                    <p className="lede" style={{ margin: 0 }}>
                      No available times on this day.
                    </p>
                  )}
                  <div className="mb-slots">
                    {slots.map((t) => {
                      const offHours =
                        timeToMin(t) < timeToMin("09:30") ||
                        timeToMin(t) > timeToMin("18:45");
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
            </div>
          )}

          <div className="ct-delta">
            <div className="ct-delta-row">
              <span className="ct-delta-k">Treatment</span>
              <span>
                <span className="ct-was">{currentTreatmentName}</span>
                <span className="ct-arrow">→</span> {selected.name}{" "}
                {selected.nameEm}
              </span>
            </div>
            <div className="ct-delta-row">
              <span className="ct-delta-k">Duration</span>
              <span>
                {selected.durationMinutes === currentDuration ? (
                  `${currentDuration} min (unchanged)`
                ) : (
                  <>
                    <span className="ct-was">{currentDuration} min</span>
                    <span className="ct-arrow">→</span>{" "}
                    {selected.durationMinutes} min
                  </>
                )}
              </span>
            </div>
            <div className="ct-delta-row">
              <span className="ct-delta-k">Price</span>
              <span>
                {selected.price === currentPrice ? (
                  `£${currentPrice} (unchanged)`
                ) : (
                  <>
                    <span className="ct-was">£{currentPrice}</span>
                    <span className="ct-arrow">→</span>{" "}
                    <strong>{selected.priceLabel}</strong>
                  </>
                )}
              </span>
            </div>
            <div className="ct-delta-row">
              <span className="ct-delta-k">When</span>
              <span>
                {movingTo ? (
                  <>
                    <span className="ct-was">{time12h(currentTime)}</span>
                    <span className="ct-arrow">→</span>{" "}
                    <strong>{newWhenLabel}</strong>
                  </>
                ) : (
                  `${currentDateLabel} at ${time12h(currentTime)} (unchanged)`
                )}
              </span>
            </div>
          </div>
        </>
      )}

      {error && (
        <div role="alert" className="error-text" style={{ marginTop: 12 }}>
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
          disabled={!canSave || submitting}
          onClick={() => setConfirmOpen(true)}
        >
          Save changes
        </button>
      </div>

      {confirmOpen && selected && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget && !submitting) setConfirmOpen(false);
          }}
        >
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`ct-modal-${bookingId}`}
          >
            <h3 className="modal-title" id={`ct-modal-${bookingId}`}>
              Confirm treatment change
            </h3>
            <div className="ct-delta" style={{ marginBottom: 4 }}>
              <div className="ct-delta-row">
                <span className="ct-delta-k">Treatment</span>
                <span>
                  <span className="ct-was">{currentTreatmentName}</span>
                  <span className="ct-arrow">→</span> {selected.name}{" "}
                  {selected.nameEm}
                </span>
              </div>
              <div className="ct-delta-row">
                <span className="ct-delta-k">Price</span>
                <span>
                  <span className="ct-was">£{currentPrice}</span>
                  <span className="ct-arrow">→</span>{" "}
                  <strong>{selected.priceLabel}</strong>
                </span>
              </div>
              <div className="ct-delta-row">
                <span className="ct-delta-k">When</span>
                <span>{newWhenLabel}</span>
              </div>
            </div>
            <p style={{ fontSize: 13, color: "var(--admin-ink-soft)", margin: "12px 0 0" }}>
              The client will be emailed a confirmation of these changes. A copy
              will be sent to you.
            </p>
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-ghost"
                disabled={submitting}
                onClick={() => setConfirmOpen(false)}
              >
                Back
              </button>
              <button
                type="button"
                className="btn"
                disabled={submitting}
                onClick={submit}
              >
                {submitting ? "Saving…" : "Confirm change"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
