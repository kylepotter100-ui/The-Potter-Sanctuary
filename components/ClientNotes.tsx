"use client";

import { useState } from "react";

export default function ClientNotes({
  customerId,
  initial,
}: {
  customerId: string;
  initial: string | null;
}) {
  const [notes, setNotes] = useState(initial ?? "");
  const [saved, setSaved] = useState(initial ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setMsg(null);
    setError(null);
    try {
      const res = await fetch(`/api/admin/customers/${customerId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      const body = (await res.json().catch(() => null)) as
        | { message?: string; error?: string }
        | null;
      if (!res.ok) throw new Error(body?.message || body?.error || "Could not save");
      setSaved(notes);
      setMsg("Saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="admin-card" style={{ marginBottom: 16 }} data-testid="client-notes">
      <p className="admin-subheading">Private notes</p>
      <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
        Only you see these — access needs, preferences, best time to call. Shown
        on each of their bookings and in your morning summary.
      </p>
      <textarea
        aria-label="Private notes about this client"
        rows={3}
        maxLength={2000}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="e.g. Hard of hearing — call, don't text. Prefers ground-floor room. Likes firm pressure on shoulders."
        style={{ width: "100%" }}
      />
      <div className="btn-row" style={{ marginTop: 8 }}>
        <button type="button" className="btn" disabled={saving || notes === saved} onClick={save}>
          {saving ? "Saving…" : "Save notes"}
        </button>
        {msg && <span className="muted" role="status">{msg}</span>}
      </div>
      {error && <p role="alert" className="error-text">{error}</p>}
    </section>
  );
}
