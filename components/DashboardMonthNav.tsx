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

  return (
    <div className={`avail-week-bar${pending ? " is-pending" : ""}`}>
      <div className="avail-week-label">{label}</div>
      <div className="avail-week-nav">
        <div className="dashboard-view-toggle" role="group" aria-label="Period">
          <button
            type="button"
            className={`btn btn-ghost btn-sm${view === "month" ? " is-selected" : ""}`}
            aria-pressed={view === "month"}
            onClick={() => go({ v: "month" })}
          >
            Month
          </button>
          <button
            type="button"
            className={`btn btn-ghost btn-sm${view === "year" ? " is-selected" : ""}`}
            aria-pressed={view === "year"}
            onClick={() => go({ v: "year" })}
          >
            Year
          </button>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={prev}>
          ← Previous
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={thisPeriod}
        >
          {view === "year" ? "This year" : "This month"}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={next}>
          Next →
        </button>
      </div>
    </div>
  );
}
