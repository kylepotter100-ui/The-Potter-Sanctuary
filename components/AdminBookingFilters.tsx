"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

type Range = "today" | "month" | "upcoming";

const RANGE_OPTIONS: Array<{ value: Range; label: string }> = [
  { value: "today", label: "Today" },
  { value: "month", label: "This month" },
  { value: "upcoming", label: "All upcoming" },
];

// Simplified booking range filter: a single segmented control. "All upcoming"
// is the default and carries no query param.
export default function AdminBookingFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const range = (searchParams.get("range") ?? "upcoming") as Range;

  function setRange(r: Range) {
    const params = new URLSearchParams(searchParams.toString());
    if (r === "upcoming") params.delete("range");
    else params.set("range", r);
    const qs = params.toString();
    startTransition(() => {
      router.replace(qs ? `/admin/bookings?${qs}` : "/admin/bookings");
    });
  }

  return (
    <div
      className={`bk-range${pending ? " is-pending" : ""}`}
      role="group"
      aria-label="Date range"
    >
      {RANGE_OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          className={`bk-range-seg${range === o.value ? " is-active" : ""}`}
          aria-pressed={range === o.value}
          onClick={() => setRange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
