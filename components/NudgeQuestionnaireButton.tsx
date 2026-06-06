"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  bookingId: string;
};

// Re-sends the branded consultation reminder for a booking whose questionnaire
// is still outstanding. Rendered inside the Consultation Response box; the
// parent only mounts it while the questionnaire is incomplete.
export default function NudgeQuestionnaireButton({ bookingId }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Transient, local-only confirmation; lingers ~60s so the owner sees it took
  // effect. The route writes nothing, so the button stays after refresh.
  const [msg, setMsg] = useState<string | null>(null);

  async function nudge() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/nudge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        alreadyCompleted?: boolean;
        error?: string;
      } | null;
      if (!res.ok) {
        throw new Error(data?.error || "Could not send reminder");
      }
      setMsg(data?.alreadyCompleted ? "Already completed" : "Reminder sent");
      window.setTimeout(() => setMsg(null), 60000);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send reminder");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: 14 }}>
      <div className="btn-row">
        <button
          type="button"
          className="btn"
          onClick={nudge}
          disabled={busy || msg !== null}
        >
          {busy ? "Sending…" : msg ?? "Nudge questionnaire"}
        </button>
      </div>
      {error && (
        <p role="alert" className="error-text" style={{ marginTop: 12 }}>
          {error}
        </p>
      )}
    </div>
  );
}
