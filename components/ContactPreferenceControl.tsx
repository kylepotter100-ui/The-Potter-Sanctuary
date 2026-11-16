"use client";

import { useState } from "react";

type Pref = "email" | "phone" | "none";
const OPTIONS: { v: Pref; label: string }[] = [
  { v: "email", label: "Email" },
  { v: "phone", label: "Phone only" },
  { v: "none", label: "Don't contact" },
];
const HINT: Record<Pref, string> = {
  email: "Confirmations, reminders, questionnaire and review requests are emailed automatically.",
  phone: "No automatic emails. Bookings appear on your morning call list so you can ring them.",
  none: "No automatic emails or reminders of any kind.",
};

export default function ContactPreferenceControl({
  customerId,
  initial,
}: {
  customerId: string;
  initial: Pref;
}) {
  const [pref, setPref] = useState<Pref>(initial);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(v: Pref) {
    if (v === pref || saving) return;
    setSaving(true);
    setError(null);
    setNote(null);
    try {
      const res = await fetch(`/api/admin/customers/${customerId}/contact-preference`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactPreference: v }),
      });
      const body = (await res.json().catch(() => null)) as
        | { message?: string; error?: string; warning?: string }
        | null;
      if (!res.ok) throw new Error(body?.message || body?.error || "Could not save");
      setPref(v);
      setNote(body?.warning ?? "Saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="admin-card" style={{ marginBottom: 16 }} data-testid="contact-pref">
      <p className="admin-subheading">How to contact this client</p>
      <div className="pillrow" role="radiogroup" aria-label="Contact preference">
        {OPTIONS.map((o) => (
          <button
            key={o.v}
            type="button"
            role="radio"
            aria-checked={pref === o.v}
            className={`gender-pill${pref === o.v ? " active" : ""}`}
            disabled={saving}
            onClick={() => choose(o.v)}
          >
            {o.label}
          </button>
        ))}
      </div>
      <p className="muted" style={{ fontSize: 13, marginTop: 8 }}>{HINT[pref]}</p>
      {note && <p className="muted" style={{ fontSize: 13 }} role="status">{note}</p>}
      {error && <p role="alert" className="error-text">{error}</p>}
    </section>
  );
}
