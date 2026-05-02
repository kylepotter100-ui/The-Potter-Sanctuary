"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

type Status = "active" | "pending" | "confirmed" | "cancelled" | "all";
type Range = "today" | "week" | "month" | "next30";

const STATUS_OPTIONS: Array<{ value: Status; label: string }> = [
  { value: "active", label: "All active" },
  { value: "pending", label: "Pending only" },
  { value: "confirmed", label: "Confirmed only" },
  { value: "cancelled", label: "Cancelled" },
  { value: "all", label: "All including cancelled" },
];

const RANGE_OPTIONS: Array<{ value: Range; label: string }> = [
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "next30", label: "Next 30 days" },
];

export default function AdminBookingFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const status = (searchParams.get("status") ?? "active") as Status;
  const range = (searchParams.get("range") ?? "") as Range | "";

  function update(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v === null || v === "") params.delete(k);
      else params.set(k, v);
    }
    const qs = params.toString();
    startTransition(() => {
      router.replace(qs ? `/admin/bookings?${qs}` : "/admin/bookings");
    });
  }

  function toggleRange(r: Range) {
    update({ range: range === r ? null : r });
  }

  return (
    <div className={`admin-filters${pending ? " is-pending" : ""}`}>
      <label className="admin-filter">
        <span>Status</span>
        <select
          value={status}
          onChange={(e) => update({ status: e.target.value })}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <div className="admin-filters-presets" role="group" aria-label="Date range">
        {RANGE_OPTIONS.map((r) => (
          <button
            key={r.value}
            type="button"
            className={`admin-preset${range === r.value ? " is-active" : ""}`}
            onClick={() => toggleRange(r.value)}
            aria-pressed={range === r.value}
          >
            {r.label}
          </button>
        ))}
      </div>
    </div>
  );
}
