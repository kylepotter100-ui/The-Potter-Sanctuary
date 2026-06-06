"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  bookingId: string;
  // Review lifecycle, derived server-side from existing tables.
  reviewState: "left" | "requested" | "none";
  // False for cancelled bookings — the active button is then hidden.
  canRequest: boolean;
};

// Renders the review control inside the Customer Review box. Three states:
// "left" and "requested" are disabled markers; "none" (and not cancelled) is an
// active button that sends the branded review request.
export default function RequestReviewButton({
  bookingId,
  reviewState,
  canRequest,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function requestReview() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/bookings/${bookingId}/request-review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }
      );
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        alreadyReviewed?: boolean;
        alreadyRequested?: boolean;
        error?: string;
      } | null;
      if (!res.ok) {
        throw new Error(data?.error || "Could not request review");
      }
      setMsg("Review requested");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not request review");
    } finally {
      setBusy(false);
    }
  }

  if (reviewState === "left") {
    return (
      <div className="btn-row" style={{ marginTop: 14 }}>
        <button type="button" className="btn" disabled>
          Review left ✓
        </button>
      </div>
    );
  }

  if (reviewState === "requested") {
    return (
      <div className="btn-row" style={{ marginTop: 14 }}>
        <button type="button" className="btn" disabled>
          Review requested
        </button>
      </div>
    );
  }

  // reviewState === "none"
  if (!canRequest) return null;

  return (
    <div style={{ marginTop: 14 }}>
      <div className="btn-row">
        <button
          type="button"
          className="btn"
          onClick={requestReview}
          disabled={busy || msg !== null}
        >
          {busy ? "Sending…" : msg ?? "Request review"}
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
