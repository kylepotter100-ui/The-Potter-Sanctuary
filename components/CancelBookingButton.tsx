"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  bookingId: string;
  treatmentName: string;
  bookingDate: string;
  bookingTime: string;
  // Full appointment start as an ISO-ish "YYYY-MM-DDTHH:MM" string. When
  // provided and the appointment is < 15 min away, the cancel button is
  // replaced with a subtle "within cancellation window" note. The cut-off
  // is also enforced server-side.
  startsAt?: string;
  // Where to land after a successful cancellation. Defaults to /account so
  // existing call sites keep their previous behaviour. Pass "/" to keep the
  // user on the homepage.
  redirectTo?: string;
  // Called after a successful cancel so the parent can refresh its data
  // (e.g. re-fetch /api/me to drop the cancelled booking from a list).
  onCancelled?: () => void;
  // Optional override for the trigger button's class (defaults to the plain
  // "cancel-booking-link" text style). The account cards pass a small danger
  // button class to match the booking-card layout.
  triggerClassName?: string;
};

export default function CancelBookingButton({
  bookingId,
  treatmentName,
  bookingDate,
  bookingTime,
  startsAt,
  redirectTo = "/account",
  onCancelled,
  triggerClassName = "cancel-booking-link",
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const withinCutoff =
    !!startsAt &&
    (new Date(startsAt).getTime() - Date.now()) / (60 * 1000) < 15;

  if (withinCutoff) {
    return (
      <span className="cancel-window-note">Within cancellation window</span>
    );
  }

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
        // Prefer the structured { message } from the API (e.g. the 15-min
        // cut-off) over the raw body.
        const data = await res.json().catch(() => null);
        throw new Error(
          (data && (data.message || data.error)) || "Cancellation failed"
        );
      }
      setOpen(false);
      // If a parent supplied an onCancelled handler we let it own the UI
      // refresh (and skip navigation altogether). This prevents the page
      // from jumping to the top, which `router.replace` would otherwise do
      // even with `scroll: false` because we're often replacing with the
      // same path. Only the /account flow uses the redirect path.
      if (onCancelled) {
        onCancelled();
      } else {
        const target = redirectTo.includes("?")
          ? `${redirectTo}&cancelled=1`
          : `${redirectTo}?cancelled=1`;
        router.replace(target, { scroll: false });
        router.refresh();
      }
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
        className={triggerClassName}
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
