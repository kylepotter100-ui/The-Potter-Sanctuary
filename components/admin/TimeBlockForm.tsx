"use client";

import { useState } from "react";
import { ukTodayIso } from "@/lib/uk-time";

// "Block out time" — part-day personal time (lunch, school run, appointments).
const TIMES: string[] = [];
for (let m = 6 * 60; m <= 22 * 60; m += 15) {
  TIMES.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
}

export default function TimeBlockForm() {
  const [date, setDate] = useState(ukTodayIso());
  const [from, setFrom] = useState("12:00");
  const [to, setTo] = useState("13:00");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send(action: "block" | "clear") {
    setBusy(true);
    setMsg(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/availability/time-block", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, from, to, action }),
      });
      const body = (await res.json().catch(() => null)) as
        | { message?: string; error?: string }
        | null;
      if (!res.ok) throw new Error(body?.message || body?.error || "Something went wrong");
      setMsg(
        action === "block"
          ? `Blocked ${from}–${to}. Clients can't book into that time. Refreshing…`
          : `Cleared ${from}–${to} — back to your usual hours. Refreshing…`
      );
      setTimeout(() => window.location.reload(), 900);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-card" style={{ marginBottom: 16 }} data-testid="time-block">
      <p className="admin-subheading">Block out time</p>
      <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
        Part of a day you&apos;re not available — lunch, school run, your own
        appointments. Treatments that would run into it can&apos;t be booked.
        For a whole day off, use the blackout dates below.
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 12,
          alignItems: "end",
        }}
      >
        <div className="field">
          <label htmlFor="tb-date">Date</label>
          <input id="tb-date" type="date" value={date} min={ukTodayIso()} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="tb-from">From</label>
          <select id="tb-from" value={from} onChange={(e) => setFrom(e.target.value)}>
            {TIMES.slice(0, -1).map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="tb-to">Until</label>
          <select id="tb-to" value={to} onChange={(e) => setTo(e.target.value)}>
            {TIMES.slice(1).map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
      </div>
      <div className="btn-row" style={{ marginTop: 8 }}>
        <button type="button" className="btn" disabled={busy} onClick={() => send("block")}>
          Block this time
        </button>
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => send("clear")}>
          Clear a block
        </button>
      </div>
      {msg && <p className="muted" role="status" style={{ fontSize: 13 }}>{msg}</p>}
      {error && <p role="alert" className="error-text">{error}</p>}
    </section>
  );
}
