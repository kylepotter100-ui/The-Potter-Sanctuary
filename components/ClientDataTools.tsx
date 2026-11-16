"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ClientDataTools({ customerId, name }: { customerId: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function erase() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/customers/${customerId}/erase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmName: confirm }),
      });
      const body = (await res.json().catch(() => null)) as { message?: string; error?: string } | null;
      if (!res.ok) throw new Error(body?.message || body?.error || "Could not erase");
      router.push("/admin/clients?erased=1");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not erase");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-card" style={{ marginBottom: 16 }} data-testid="client-data">
      <p className="admin-subheading">Their data (UK GDPR)</p>
      <div className="btn-row">
        <a className="btn btn-ghost" href={`/api/admin/customers/${customerId}/export`} data-testid="export-data">
          Download client data
        </a>
        <button type="button" className="btn btn-ghost" onClick={() => setOpen((o) => !o)} data-testid="erase-open">
          Erase client…
        </button>
      </div>
      {open && (
        <div style={{ marginTop: 12 }}>
          <p className="muted" style={{ fontSize: 13 }}>
            Permanently deletes {name}&apos;s record, consultation answers, reviews,
            notes and sign-in. Past bookings stay in your diary as &ldquo;Erased
            client&rdquo; so your takings still add up. This can&apos;t be undone.
          </p>
          <label htmlFor="erase-confirm" style={{ fontSize: 13 }}>Type <strong>{name}</strong> to confirm</label>
          <input id="erase-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} style={{ width: "100%", marginTop: 4 }} />
          <button type="button" className="btn" style={{ marginTop: 8, background: "#9c3b33" }} disabled={busy || !confirm.trim()} onClick={erase}>
            {busy ? "Erasing…" : "Permanently erase"}
          </button>
          {error && <p role="alert" className="error-text">{error}</p>}
        </div>
      )}
    </section>
  );
}
