"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  bookingId: string;
  status: "pending" | "confirmed";
};

export default function AdminBookingActions({ bookingId, status }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<"confirm" | "cancel" | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

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
        const text = await res.text();
        throw new Error(text || "Could not confirm");
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
        const text = await res.text();
        throw new Error(text || "Could not cancel");
      }
      setModalOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel");
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
