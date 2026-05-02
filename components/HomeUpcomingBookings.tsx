"use client";

import { useEffect, useState } from "react";
import CancelBookingButton from "./CancelBookingButton";

type Upcoming = {
  id: string;
  treatment_name: string;
  booking_date: string;
  booking_time: string;
  status: "pending" | "confirmed" | "cancelled";
};

function formatLongDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function formatTime12h(t: string): string {
  // "11:00" → "11:00am", "13:30" → "1:30pm"
  const [hh, mm] = t.slice(0, 5).split(":");
  const h24 = Number(hh);
  const ampm = h24 >= 12 ? "pm" : "am";
  const h12 = ((h24 + 11) % 12) + 1;
  return `${h12}:${mm}${ampm}`;
}

export default function HomeUpcomingBookings() {
  const [upcoming, setUpcoming] = useState<Upcoming[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { upcomingBookings: [] }))
      .then((data: { upcomingBookings?: Upcoming[] }) => {
        if (cancelled) return;
        setUpcoming(data.upcomingBookings ?? []);
      })
      .catch(() => {
        if (!cancelled) setUpcoming([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!upcoming || upcoming.length === 0) return null;

  return (
    <section
      className="home-upcoming"
      aria-label="Your upcoming sessions"
    >
      <h3>Your upcoming sessions</h3>
      <ul>
        {upcoming.map((b) => {
          const dateLong = formatLongDate(b.booking_date);
          const timeNice = formatTime12h(b.booking_time);
          return (
            <li key={b.id}>
              <div className="home-upcoming-meta">
                <div className="home-upcoming-when">
                  {dateLong} at {timeNice}
                </div>
                <div className="home-upcoming-treatment">
                  {b.treatment_name}
                </div>
              </div>
              <div className="home-upcoming-actions">
                <span className={`badge badge-${b.status}`}>{b.status}</span>
                <CancelBookingButton
                  bookingId={b.id}
                  treatmentName={b.treatment_name}
                  bookingDate={dateLong}
                  bookingTime={timeNice}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
