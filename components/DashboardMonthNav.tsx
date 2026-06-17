"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

type Props = {
  year: number;
  month: number; // 1-12
  view: "month" | "year";
};

export default function DashboardMonthNav({ year, month, view }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function go(next: { y?: number; m?: number; v?: "month" | "year" }) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("year", String(next.y ?? year));
    params.set("month", String(next.m ?? month));
    params.set("view", next.v ?? view);
    startTransition(() => {
      router.replace(`/admin/dashboard?${params.toString()}`);
    });
  }

  function prev() {
    if (view === "year") {
      go({ y: year - 1 });
      return;
    }
    const m = month - 1;
    if (m < 1) go({ y: year - 1, m: 12 });
    else go({ m });
  }
  function next() {
    if (view === "year") {
      go({ y: year + 1 });
      return;
    }
    const m = month + 1;
    if (m > 12) go({ y: year + 1, m: 1 });
    else go({ m });
  }
  function thisPeriod() {
    const now = new Date();
    go({ y: now.getFullYear(), m: now.getMonth() + 1 });
  }

  const label = view === "year" ? String(year) : `${MONTHS[month - 1]} ${year}`;

  // "Today" reset only shows when the viewed period isn't the current one, so
  // the bar stays clean by default. Compared against the local clock (the same
  // basis thisPeriod() resets to).
  const now = new Date();
  const isCurrent =
    view === "year"
      ? year === now.getFullYear()
      : year === now.getFullYear() && month === now.getMonth() + 1;

  return (
    <div className={`dash-filter${pending ? " is-pending" : ""}`}>
      <div className="dash-filter-period">
        <button
          type="button"
          className="dash-step"
          aria-label={view === "year" ? "Previous year" : "Previous month"}
          onClick={prev}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>
        <span className="dash-filter-label">{label}</span>
        <button
          type="button"
          className="dash-step"
          aria-label={view === "year" ? "Next year" : "Next month"}
          onClick={next}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
        {!isCurrent && (
          <button type="button" className="dash-today" onClick={thisPeriod}>
            Today
          </button>
        )}
      </div>
      <div className="dashboard-view-toggle" role="group" aria-label="Period">
        <button
          type="button"
          className={`btn btn-ghost btn-sm${view === "year" ? " is-selected" : ""}`}
          aria-pressed={view === "year"}
          onClick={() => go({ v: "year" })}
        >
          Year
        </button>
        <button
          type="button"
          className={`btn btn-ghost btn-sm${view === "month" ? " is-selected" : ""}`}
          aria-pressed={view === "month"}
          onClick={() => go({ v: "month" })}
        >
          Month
        </button>
      </div>
    </div>
  );
}
