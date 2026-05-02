"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

type Status = "active" | "pending" | "confirmed" | "cancelled" | "all";

const STATUS_OPTIONS: Array<{ value: Status; label: string }> = [
  { value: "active", label: "All active" },
  { value: "pending", label: "Pending only" },
  { value: "confirmed", label: "Confirmed only" },
  { value: "cancelled", label: "Cancelled" },
  { value: "all", label: "All including cancelled" },
];

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function startOfWeek(iso: string): string {
  // Monday as start of week (en-GB convention).
  const d = new Date(iso + "T00:00:00");
  const dow = d.getDay(); // 0=Sun, 1=Mon, …
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function endOfWeek(iso: string): string {
  return addDays(startOfWeek(iso), 6);
}

function startOfMonth(iso: string): string {
  return iso.slice(0, 8) + "01";
}

function endOfMonth(iso: string): string {
  const [y, m] = iso.split("-").map(Number);
  const d = new Date(y, m, 0);
  return d.toISOString().slice(0, 10);
}

export default function AdminBookingFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const status = (searchParams.get("status") ?? "active") as Status;
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const q = searchParams.get("q") ?? "";

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

  function applyPreset(preset: "today" | "week" | "month" | "next30") {
    const today = isoToday();
    if (preset === "today") update({ from: today, to: today });
    else if (preset === "week")
      update({ from: startOfWeek(today), to: endOfWeek(today) });
    else if (preset === "month")
      update({ from: startOfMonth(today), to: endOfMonth(today) });
    else update({ from: today, to: addDays(today, 30) });
  }

  function clearAll() {
    startTransition(() => {
      router.replace("/admin/bookings");
    });
  }

  const isFiltered = status !== "active" || from || to || q;

  return (
    <div className={`admin-filters${pending ? " is-pending" : ""}`}>
      <div className="admin-filters-row">
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

        <label className="admin-filter">
          <span>From</span>
          <input
            type="date"
            value={from}
            onChange={(e) => update({ from: e.target.value || null })}
          />
        </label>

        <label className="admin-filter">
          <span>To</span>
          <input
            type="date"
            value={to}
            onChange={(e) => update({ to: e.target.value || null })}
          />
        </label>

        <label className="admin-filter admin-filter-search">
          <span>Search</span>
          <input
            type="search"
            placeholder="Name or email"
            value={q}
            onChange={(e) => update({ q: e.target.value || null })}
          />
        </label>
      </div>

      <div className="admin-filters-presets">
        <button type="button" onClick={() => applyPreset("today")}>
          Today
        </button>
        <button type="button" onClick={() => applyPreset("week")}>
          This week
        </button>
        <button type="button" onClick={() => applyPreset("month")}>
          This month
        </button>
        <button type="button" onClick={() => applyPreset("next30")}>
          Next 30 days
        </button>
        {isFiltered && (
          <button type="button" className="admin-filter-clear" onClick={clearAll}>
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
