"use client";

import { useState } from "react";
import RequestReviewButton from "./RequestReviewButton";

type Client = {
  key: string;
  name: string;
  email: string;
  sessions: { treatment: string; date: string }[];
  count: number;
  lastDate: string;
  targetBookingId: string;
  reviewState: "requested" | "none";
};

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// "5 Jun 2026" — sliced, not Date-parsed, so it never drifts with UTC.
function fmtDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  const mi = Number(m) - 1;
  if (!y || mi < 0 || mi > 11) return iso.slice(0, 10);
  return `${Number(d)} ${MONTHS_SHORT[mi]} ${y}`;
}

// By-customer chase list. Tap a client to reveal their completed sessions and
// the Request-review control (reuses RequestReviewButton → the existing
// per-booking request-review endpoint, targeting the most recent session).
export default function OutstandingReviewsList({
  clients,
}: {
  clients: Client[];
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);

  return (
    <ul className="outstanding-list">
      {clients.map((c) => {
        const open = openKey === c.key;
        return (
          <li key={c.key} className={`outstanding-card${open ? " is-open" : ""}`}>
            <button
              type="button"
              className="outstanding-head"
              aria-expanded={open}
              onClick={() => setOpenKey(open ? null : c.key)}
            >
              <span className="outstanding-main">
                <span className="outstanding-name">{c.name}</span>
                <span className="outstanding-email">{c.email}</span>
                <span className="outstanding-meta">
                  {c.count} {c.count === 1 ? "session" : "sessions"} · last{" "}
                  {fmtDate(c.lastDate)}
                  {c.reviewState === "requested" ? " · already requested" : ""}
                </span>
              </span>
              <span className="outstanding-chevron" aria-hidden="true">
                {open ? "▾" : "▸"}
              </span>
            </button>

            {open && (
              <div className="outstanding-detail">
                <p className="outstanding-detail-label">Booked sessions</p>
                <ul className="outstanding-sessions">
                  {c.sessions.map((s, i) => (
                    <li key={i}>
                      <span>{s.treatment}</span>
                      <span>{fmtDate(s.date)}</span>
                    </li>
                  ))}
                </ul>
                <RequestReviewButton
                  bookingId={c.targetBookingId}
                  reviewState={c.reviewState}
                  canRequest
                />
                {c.reviewState === "none" && (
                  <p className="outstanding-hint">
                    Sends to the most recent completed session.
                  </p>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
