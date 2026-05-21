"use client";

import { useState } from "react";

type Props = {
  bookingId: string;
};

export default function ReviewForm({ bookingId }: Props) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating < 1) {
      setError("Please choose a star rating.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          booking_id: bookingId,
          rating,
          comment: comment.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not save your review.");
      }
      setDone(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save your review."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="review-success">
        <div className="review-success-icon" aria-hidden="true">
          ✓
        </div>
        <h2>Thank you for your feedback.</h2>
        <p>It helps us refine the sanctuary experience.</p>
      </div>
    );
  }

  return (
    <form className="review-form" onSubmit={onSubmit} noValidate>
      <fieldset className="review-stars" aria-label="Rating out of 5">
        {[1, 2, 3, 4, 5].map((n) => {
          const filled = (hover || rating) >= n;
          return (
            <button
              key={n}
              type="button"
              className={`review-star${filled ? " is-filled" : ""}`}
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
              aria-pressed={rating === n}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              onFocus={() => setHover(n)}
              onBlur={() => setHover(0)}
              onClick={() => setRating(n)}
            >
              {filled ? "★" : "☆"}
            </button>
          );
        })}
      </fieldset>

      <label htmlFor="review-comment">
        Anything you&apos;d like to share?{" "}
        <span className="review-optional">(optional)</span>
      </label>
      <textarea
        id="review-comment"
        rows={4}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Your words help us, and other guests."
      />

      {error && (
        <div role="alert" className="login-error">
          {error}
        </div>
      )}

      <button type="submit" className="login-btn" disabled={submitting}>
        {submitting ? "Sending…" : "Submit feedback"}
      </button>
    </form>
  );
}
