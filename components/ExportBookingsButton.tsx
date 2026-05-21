"use client";

import { useState } from "react";

// Fetches the CSV export from the admin API and triggers a browser
// download. All-time export by default (the API also accepts ?from/&to).
export default function ExportBookingsButton() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onExport() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/bookings/export");
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename =
        match?.[1] ??
        `potter-sanctuary-bookings-${new Date().toISOString().slice(0, 10)}.csv`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="export-bookings">
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={onExport}
        disabled={busy}
      >
        {busy ? "Preparing…" : "Export bookings (CSV)"}
      </button>
      {error && <span className="export-error">{error}</span>}
    </span>
  );
}
