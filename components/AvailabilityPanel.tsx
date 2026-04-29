"use client";

import { useState, useTransition } from "react";
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

type Props = {
  availability: AvailabilityRow[];
  blocked: BlockedRow[];
};

const DAYS: Array<{ idx: number; name: string }> = [
  { idx: 2, name: "Tuesday" },
  { idx: 3, name: "Wednesday" },
  { idx: 4, name: "Thursday" },
  { idx: 5, name: "Friday" },
  { idx: 6, name: "Saturday" },
];

function generateSlots(): string[] {
  const out: string[] = [];
  let m = 9 * 60 + 30; // 09:30
  const end = 19 * 60; // 19:00 inclusive
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

function formatBlockedDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function AvailabilityPanel({ availability, blocked }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [, setRefreshTick] = useState(0);

  // Build a quick-lookup map: "day:HH:MM:SS" → is_active
  const map = new Map<string, boolean>();
  for (const a of availability) {
    map.set(`${a.day_of_week}:${normalize(a.slot_time)}`, a.is_active);
  }

  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [blockError, setBlockError] = useState<string | null>(null);

  async function toggleSlot(day: number, slot: string, currentlyActive: boolean) {
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
      // Roll back optimistic update on failure
      map.set(`${day}:${normalize(slot)}`, currentlyActive);
      setRefreshTick((n) => n + 1);
    }
  }

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

  return (
    <>
      <h2 style={{ marginBottom: 14 }}>Weekly availability</h2>
      <p className="lede">
        Toggle slots on or off for each day. Tuesdays through Saturdays, every
        30 minutes from 09:30 to 19:00. Changes save automatically.
      </p>
      {DAYS.map((d) => (
        <div key={d.idx} className="day-block">
          <h3>{d.name}</h3>
          <div className="slot-grid">
            {SLOTS.map((slot) => {
              const active = map.get(`${d.idx}:${normalize(slot)}`) ?? false;
              return (
                <button
                  key={slot}
                  type="button"
                  className={`slot-toggle${active ? " is-active" : ""}`}
                  onClick={() => toggleSlot(d.idx, slot, active)}
                  disabled={pending}
                >
                  {slot}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <h2 style={{ marginTop: 36, marginBottom: 14 }}>Blocked dates</h2>
      <p className="lede">
        Holidays, training days, anything else. Blocked dates take precedence
        over the weekly grid.
      </p>

      <form onSubmit={block} className="admin-card" style={{ marginBottom: 16 }}>
        {blockError && <div className="error-text">{blockError}</div>}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(160px, 200px) 1fr auto", gap: 12, alignItems: "end" }}>
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
                  <span style={{ opacity: 0.65, marginLeft: 10 }}>· {b.reason}</span>
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
