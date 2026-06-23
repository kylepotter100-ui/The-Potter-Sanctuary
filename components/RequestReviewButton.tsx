"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  bookingId: string;
  // Review lifecycle, derived server-side from existing tables.
  reviewState: "left" | "requested" | "none";
  // False for cancelled bookings — the active button is then hidden.
  canRequest: boolean;
  // When the last request went out (review_email_sent_at), shown on the
  // "requested" state so the admin can see how recently it was sent.
  lastRequestedAt?: string | null;
  // Where the "left" state links to so the owner can read the review (the
  // client's profile lists their reviews). Falls back to all reviews.
  reviewHref?: string;
};

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// "5 Jun 2026" from an ISO timestamp — sliced, not Date-parsed, so it never
// drifts with the server/client clock.
function fmtDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  const mi = Number(m) - 1;
  if (!y || mi < 0 || mi > 11) return iso.slice(0, 10);
  return `${Number(d)} ${MONTHS_SHORT[mi]} ${y}`;
}

// Renders the review control. Three states:
//   "left"      → disabled ✓ marker (already reviewed).
//   "requested" → shows the last-requested date + an active "Send another
//                 request", gated by an inline confirm before re-sending.
//   "none"      → active "Request review" (first send, no confirm).
export default function RequestReviewButton({
  bookingId,
  reviewState,
  canRequest,
  lastRequestedAt,
  reviewHref = "/admin/reviews",
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function requestReview(resend: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/bookings/${bookingId}/request-review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resend }),
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
      setConfirming(false);
      setMsg(resend ? "Another request sent" : "Review requested");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not request review");
    } finally {
      setBusy(false);
    }
  }

  if (reviewState === "left") {
    // Already reviewed — no send path. Link to the review instead of a dead button.
    return (
      <div className="btn-row" style={{ marginTop: 14 }}>
        <Link href={reviewHref} className="btn btn-ghost">
          View review →
        </Link>
      </div>
    );
  }

  if (reviewState === "requested") {
    return (
      <div style={{ marginTop: 14 }}>
        {lastRequestedAt && (
          <p className="review-last-requested">
            Last requested {fmtDate(lastRequestedAt)}
          </p>
        )}
        {confirming ? (
          <>
            <p className="review-confirm-q">
              Are you sure you want to send another request for a review?
            </p>
            <div className="btn-row">
              <button
                type="button"
                className="btn"
                onClick={() => requestReview(true)}
                disabled={busy || msg !== null}
              >
                {busy ? "Sending…" : "Yes, send again"}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setConfirming(false)}
                disabled={busy}
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <div className="btn-row">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setConfirming(true)}
              disabled={msg !== null}
            >
              {msg ?? "Send another request"}
            </button>
          </div>
        )}
        {error && (
          <p role="alert" className="error-text" style={{ marginTop: 12 }}>
            {error}
          </p>
        )}
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
          onClick={() => requestReview(false)}
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
