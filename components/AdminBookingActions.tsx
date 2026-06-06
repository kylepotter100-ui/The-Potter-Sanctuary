"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  bookingId: string;
  status: "pending" | "confirmed";
  // Whether the consultation questionnaire is still outstanding for this
  // booking. When false, the "Nudge questionnaire" button is hidden.
  questionnaireOutstanding?: boolean;
  // Review lifecycle for this booking, derived server-side from existing
  // tables: "left" (reviews row exists), "requested" (review_email_sent_at
  // set, no review yet) or "none" (can still be requested).
  reviewState?: "left" | "requested" | "none";
};

export default function AdminBookingActions({
  bookingId,
  status,
  questionnaireOutstanding = false,
  reviewState = "none",
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<
    "confirm" | "cancel" | "nudge" | "review" | null
  >(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Transient, local-only confirmations (no persistence). The nudge one
  // lingers ~60s so the owner sees it took effect; the server state for the
  // review button updates on router.refresh().
  const [nudgeMsg, setNudgeMsg] = useState<string | null>(null);
  const [reviewMsg, setReviewMsg] = useState<string | null>(null);

  async function confirm() {
    setBusy("confirm");
    setError(null);
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "confirmed" }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          message?: string;
          error?: string;
        } | null;
        throw new Error(
          data?.message || data?.error || "Could not confirm"
        );
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not confirm");
    } finally {
      setBusy(null);
    }
  }

  async function submitCancel() {
    if (!reason.trim()) {
      setError("Please provide a reason — it will be shared with the customer.");
      return;
    }
    setBusy("cancel");
    setError(null);
    try {
      const res = await fetch(`/api/admin/bookings/${bookingId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          message?: string;
          error?: string;
        } | null;
        throw new Error(data?.message || data?.error || "Could not cancel");
      }
      setModalOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel");
    } finally {
      setBusy(null);
    }
  }

  async function nudge() {
    setBusy("nudge");
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
      setNudgeMsg(data?.alreadyCompleted ? "Already completed" : "Reminder sent");
      window.setTimeout(() => setNudgeMsg(null), 60000);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send reminder");
    } finally {
      setBusy(null);
    }
  }

  async function requestReview() {
    setBusy("review");
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
      setReviewMsg("Review requested");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not request review");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className="btn-row">
        <button
          type="button"
          className="btn"
          onClick={confirm}
          disabled={busy !== null || status === "confirmed"}
        >
          {busy === "confirm" ? "Confirming…" : "Confirm Booking"}
        </button>
        <button
          type="button"
          className="btn btn-danger"
          onClick={() => {
            setError(null);
            setReason("");
            setModalOpen(true);
          }}
          disabled={busy !== null}
        >
          Cancel Booking
        </button>
      </div>

      <div className="btn-row" style={{ marginTop: 12 }}>
        {questionnaireOutstanding && (
          <button
            type="button"
            className="btn"
            onClick={nudge}
            disabled={busy !== null || nudgeMsg !== null}
          >
            {busy === "nudge"
              ? "Sending…"
              : nudgeMsg ?? "Nudge questionnaire"}
          </button>
        )}

        {reviewState === "left" ? (
          <button type="button" className="btn" disabled>
            Review left ✓
          </button>
        ) : reviewState === "requested" ? (
          <button type="button" className="btn" disabled>
            Review requested
          </button>
        ) : (
          <button
            type="button"
            className="btn"
            onClick={requestReview}
            disabled={busy !== null || reviewMsg !== null}
          >
            {busy === "review" ? "Sending…" : reviewMsg ?? "Request review"}
          </button>
        )}
      </div>
      {reviewState === "left" && (
        <p className="lede" style={{ marginTop: 8, fontSize: 14 }}>
          This customer has already left a review.
        </p>
      )}

      {error && !modalOpen && (
        <p role="alert" className="error-text" style={{ marginTop: 12 }}>
          {error}
        </p>
      )}

      {modalOpen && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`admin-cancel-modal-${bookingId}`}
          onClick={(e) => {
            if (e.target === e.currentTarget && busy === null) {
              setModalOpen(false);
            }
          }}
        >
          <div className="modal-card">
            <h3
              id={`admin-cancel-modal-${bookingId}`}
              className="modal-title"
            >
              Cancel this booking?
            </h3>
            <div className="field">
              <label htmlFor={`admin-cancel-reason-${bookingId}`}>
                Reason for cancellation (will be shared with customer)
              </label>
              <textarea
                id={`admin-cancel-reason-${bookingId}`}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                required
              />
            </div>
            {error && (
              <div role="alert" className="modal-error">
                {error}
              </div>
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setModalOpen(false)}
                disabled={busy === "cancel"}
              >
                Keep booking
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={submitCancel}
                disabled={busy === "cancel"}
              >
                {busy === "cancel" ? "Cancelling…" : "Confirm cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
