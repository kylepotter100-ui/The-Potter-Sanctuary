"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  bookingId: string;
  currentDate: string; // YYYY-MM-DD
  currentTime: string; // HH:MM
};

// Owner reschedule: "book anytime" — pick any date/time (a true clash with
// another appointment is still blocked server-side + by the DB constraint).
// Moves the booking and emails the client the reschedule confirmation.
export default function AdminRescheduleButton({
  bookingId,
  currentDate,
  currentTime,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(currentDate);
  const [time, setTime] = useState(currentTime);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, time }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          message?: string;
          error?: string;
        } | null;
        throw new Error(data?.message || data?.error || "Could not reschedule");
      }
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reschedule");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="btn btn-ghost"
        onClick={() => {
          setError(null);
          setDate(currentDate);
          setTime(currentTime);
          setOpen(true);
        }}
      >
        Reschedule
      </button>

      {open && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Reschedule booking"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) setOpen(false);
          }}
        >
          <div className="modal-card">
            <h3 className="modal-title">Reschedule booking</h3>
            <p style={{ fontSize: 13, color: "var(--admin-ink-soft)", margin: "0 0 14px" }}>
              Pick any new date and time. The client will be emailed a
              reschedule confirmation.
            </p>
            <div className="field">
              <label htmlFor={`rs-date-${bookingId}`}>New date</label>
              <input
                id={`rs-date-${bookingId}`}
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor={`rs-time-${bookingId}`}>New time</label>
              <input
                id={`rs-time-${bookingId}`}
                type="time"
                step={900}
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
            {error && (
              <div role="alert" className="modal-error">
                {error}
              </div>
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setOpen(false)}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn"
                onClick={submit}
                disabled={busy || !date || !time}
              >
                {busy ? "Rescheduling…" : "Confirm new time"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
