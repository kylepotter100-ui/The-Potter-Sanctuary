"use client";

import { useState } from "react";

type A = "attended" | "no_show" | null;

export default function AttendanceButtons({
  bookingId,
  initial,
}: {
  bookingId: string;
  initial: A;
}) {
  const [value, setValue] = useState<A>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function set(v: A) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attendance: v }),
      });
      const body = (await res.json().catch(() => null)) as { message?: string; error?: string } | null;
      if (!res.ok) throw new Error(body?.message || body?.error || "Could not save");
      setValue(v);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-card" style={{ marginBottom: 16 }} data-testid="attendance">
      <h2 style={{ fontFamily: "var(--font-serif)", marginTop: 0 }}>Did they attend?</h2>
      <div className="btn-row">
        <button
          type="button"
          className={value === "attended" ? "btn" : "btn btn-ghost"}
          aria-pressed={value === "attended"}
          disabled={busy}
          onClick={() => set(value === "attended" ? null : "attended")}
        >
          {value === "attended" ? "✓ Attended" : "Attended"}
        </button>
        <button
          type="button"
          className={value === "no_show" ? "btn" : "btn btn-ghost"}
          aria-pressed={value === "no_show"}
          disabled={busy}
          onClick={() => set(value === "no_show" ? null : "no_show")}
        >
          {value === "no_show" ? "✕ No-show" : "No-show"}
        </button>
      </div>
      <p className="muted" style={{ fontSize: 13, marginTop: 8 }} role="status">
        {value === "no_show"
          ? "Recorded as a no-show: excluded from revenue, and no review request will be sent."
          : value === "attended"
            ? "Recorded as attended."
            : "Tap one after the appointment. Tap again to undo."}
      </p>
      {error && <p role="alert" className="error-text">{error}</p>}
    </section>
  );
}
