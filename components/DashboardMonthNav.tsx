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
};

export default function DashboardMonthNav({ year, month }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function go(y: number, m: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("year", String(y));
    params.set("month", String(m));
    startTransition(() => {
      router.replace(`/admin/dashboard?${params.toString()}`);
    });
  }

  function prev() {
    const m = month - 1;
    if (m < 1) go(year - 1, 12);
    else go(year, m);
  }
  function next() {
    const m = month + 1;
    if (m > 12) go(year + 1, 1);
    else go(year, m);
  }
  function thisMonth() {
    const now = new Date();
    go(now.getFullYear(), now.getMonth() + 1);
  }

  return (
    <div className={`avail-week-bar${pending ? " is-pending" : ""}`}>
      <div className="avail-week-label">
        {MONTHS[month - 1]} {year}
      </div>
      <div className="avail-week-nav">
        <button type="button" className="btn btn-ghost btn-sm" onClick={prev}>
          ← Previous
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={thisMonth}
        >
          This month
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={next}>
          Next →
        </button>
      </div>
    </div>
  );
}
