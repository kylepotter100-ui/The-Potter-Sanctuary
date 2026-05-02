"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  bookingId: string;
  treatmentName: string;
  bookingDate: string;
  bookingTime: string;
};

export default function CancelBookingButton({
  bookingId,
  treatmentName,
  bookingDate,
  bookingTime,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmCancel() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Cancellation failed");
      }
      setOpen(false);
      router.replace("/account?cancelled=1");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel booking");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="cancel-booking-link"
        onClick={() => setOpen(true)}
      >
        Cancel booking
      </button>

      {open && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`cancel-modal-title-${bookingId}`}
          onClick={(e) => {
            if (e.target === e.currentTarget && !submitting) setOpen(false);
          }}
        >
          <div className="modal-card">
            <h3
              id={`cancel-modal-title-${bookingId}`}
              className="modal-title"
            >
              Cancel your booking?
            </h3>
            <p className="modal-body">
              Are you sure you want to cancel your{" "}
              <strong>{treatmentName}</strong> on {bookingDate} at {bookingTime}
              ? We ask for at least 12 hours notice as a courtesy.
            </p>
            <div className="field">
              <label htmlFor={`cancel-reason-${bookingId}`}>
                Reason for cancellation (optional)
              </label>
              <textarea
                id={`cancel-reason-${bookingId}`}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="Anything you'd like to share — feeling unwell, schedule clash, etc."
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
                className="btn-secondary"
                onClick={() => setOpen(false)}
                disabled={submitting}
              >
                Keep booking
              </button>
              <button
                type="button"
                className="btn-danger-solid"
                onClick={confirmCancel}
                disabled={submitting}
              >
                {submitting ? "Cancelling…" : "Yes, cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
