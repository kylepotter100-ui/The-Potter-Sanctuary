"use client";

import { useCallback, useEffect, useState } from "react";
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
  const [hh, mm] = t.slice(0, 5).split(":");
  const h24 = Number(hh);
  const ampm = h24 >= 12 ? "pm" : "am";
  const h12 = ((h24 + 11) % 12) + 1;
  return `${h12}:${mm}${ampm}`;
}

export default function HomeUpcomingBookings() {
  const [upcoming, setUpcoming] = useState<Upcoming[] | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const res = await fetch("/api/me", { cache: "no-store" });
      if (!res.ok) {
        setUpcoming([]);
        return;
      }
      const data = (await res.json()) as { upcomingBookings?: Upcoming[] };
      setUpcoming(data.upcomingBookings ?? []);
    } catch {
      setUpcoming([]);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // If we landed back on / with ?cancelled=1, surface the toast and clean
  // the URL so a refresh doesn't show it again. We don't use useSearchParams
  // because that would force the parent route to be dynamic.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("cancelled") === "1") {
      setToast("Your booking has been cancelled.");
      url.searchParams.delete("cancelled");
      const clean =
        url.pathname +
        (url.searchParams.toString() ? `?${url.searchParams.toString()}` : "") +
        url.hash;
      window.history.replaceState({}, "", clean);
      const t = setTimeout(() => setToast(null), 6000);
      return () => clearTimeout(t);
    }
  }, []);

  function onCancelled() {
    setToast("Your booking has been cancelled.");
    reload();
  }

  if (!upcoming || upcoming.length === 0) {
    // Even with no bookings, still show the toast briefly if present.
    return toast ? (
      <div role="status" className="home-upcoming-toast">
        {toast}
      </div>
    ) : null;
  }

  return (
    <>
      {toast && (
        <div role="status" className="home-upcoming-toast">
          {toast}
        </div>
      )}
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
                    redirectTo="/"
                    onCancelled={onCancelled}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
