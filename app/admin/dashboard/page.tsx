import Link from "next/link";
import AdminHeader from "@/components/AdminHeader";
import DashboardMonthNav from "@/components/DashboardMonthNav";
import ExportBookingsButton from "@/components/ExportBookingsButton";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SearchParams = Promise<{ year?: string; month?: string; view?: string }>;

type RevenueRow = { treatment_price: number; booking_date: string };
type PopularityRow = { treatment_name: string };

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function isoDate(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`;
}

function startOfMonthIso(y: number, m: number): string {
  return isoDate(y, m, 1);
}

function endOfMonthIso(y: number, m: number): string {
  // Day 0 of next month → last day of current month.
  const last = new Date(y, m, 0).getDate();
  return isoDate(y, m, last);
}

function formatMoney(n: number): string {
  return `£${Math.round(n).toLocaleString("en-GB")}`;
}

// Current year/month in Europe/London, so "this month"/"this year" defaults are
// correct regardless of server timezone (mirrors ukTodayIso in AvailabilityPanel).
function ukNowParts(): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { year: Number(get("year")), month: Number(get("month")) };
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;

  const ukNow = ukNowParts();
  const yearParam = Number(params.year);
  const monthParam = Number(params.month);
  const year =
    Number.isFinite(yearParam) && yearParam > 1900 ? yearParam : ukNow.year;
  const month =
    Number.isFinite(monthParam) && monthParam >= 1 && monthParam <= 12
      ? monthParam
      : ukNow.month;
  const view = params.view === "year" ? "year" : "month";

  if (!supabaseAdmin) {
    return (
      <>
        <AdminHeader active="dashboard" />
        <main className="admin-main">
          <h1>Dashboard</h1>
          <p className="lede">
            Supabase isn&apos;t configured yet — set{" "}
            <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code>SUPABASE_SERVICE_ROLE_KEY</code> in your environment, then
            run the SQL in <code>/supabase/schema.sql</code>.
          </p>
        </main>
      </>
    );
  }

  // Period bounds follow the month/year toggle.
  const periodStart =
    view === "year" ? isoDate(year, 1, 1) : startOfMonthIso(year, month);
  const periodEnd =
    view === "year" ? isoDate(year, 12, 31) : endOfMonthIso(year, month);

  const [pending, confirmed, cancelled, total, revenueRes, popularityRes] =
    await Promise.all([
      supabaseAdmin
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending")
        .gte("booking_date", periodStart)
        .lte("booking_date", periodEnd),
      supabaseAdmin
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("status", "confirmed")
        .gte("booking_date", periodStart)
        .lte("booking_date", periodEnd),
      supabaseAdmin
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .eq("status", "cancelled")
        .gte("booking_date", periodStart)
        .lte("booking_date", periodEnd),
      supabaseAdmin
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .gte("booking_date", periodStart)
        .lte("booking_date", periodEnd),
      // Revenue: confirmed bookings' list prices over the period. Summed in JS
      // (low volume); booking_date is also used to bucket per-month in year mode.
      supabaseAdmin
        .from("bookings")
        .select("treatment_price, booking_date")
        .eq("status", "confirmed")
        .gte("booking_date", periodStart)
        .lte("booking_date", periodEnd),
      // Most-booked: all non-cancelled bookings (real demand) grouped in JS.
      supabaseAdmin
        .from("bookings")
        .select("treatment_name")
        .neq("status", "cancelled")
        .gte("booking_date", periodStart)
        .lte("booking_date", periodEnd),
    ]);

  const revenueRows = (revenueRes.data ?? []) as RevenueRow[];
  const popularityRows = (popularityRes.data ?? []) as PopularityRow[];

  const revenueTotal = revenueRows.reduce(
    (sum, r) => sum + (r.treatment_price ?? 0),
    0
  );

  // Per-month confirmed revenue (year mode only).
  const perMonth = Array.from({ length: 12 }, () => 0);
  if (view === "year") {
    for (const r of revenueRows) {
      const m = Number(r.booking_date.slice(5, 7));
      if (m >= 1 && m <= 12) perMonth[m - 1] += r.treatment_price ?? 0;
    }
  }
  const maxMonth = Math.max(1, ...perMonth);

  // Most-booked ranking, top 5.
  const tally = new Map<string, number>();
  for (const r of popularityRows) {
    tally.set(r.treatment_name, (tally.get(r.treatment_name) ?? 0) + 1);
  }
  const ranking = [...tally.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const periodLabel = view === "year" ? "this year" : "this month";

  return (
    <>
      <AdminHeader active="dashboard" />
      <main className="admin-main">
        <h1>Dashboard</h1>
        <p className="lede">An at-a-glance view of the studio.</p>

        <DashboardMonthNav year={year} month={month} view={view} />

        <div className="dashboard-tools">
          <ExportBookingsButton />
          <Link href="/admin/bookings" className="btn btn-ghost btn-sm">
            All bookings →
          </Link>
        </div>

        <div className="stat-hero">
          <span className="label">Revenue — confirmed</span>
          <span className="value">{formatMoney(revenueTotal)}</span>
          <span className="caption">List price · excludes any discounts</span>
        </div>

        {view === "year" && (
          <section>
            <h2>Revenue by month</h2>
            <div className="month-bars">
              {perMonth.map((amt, i) => (
                <div className="month-bar" key={MONTHS_SHORT[i]}>
                  <span className="month-label">{MONTHS_SHORT[i]}</span>
                  <div className="bar-track">
                    <div
                      className="bar-fill"
                      style={{ width: `${(amt / maxMonth) * 100}%` }}
                    />
                  </div>
                  <span className="month-value">{formatMoney(amt)}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="stat-row">
          <div className="stat-card">
            <span className="label">Pending</span>
            <span className="value">{pending.count ?? 0}</span>
          </div>
          <div className="stat-card">
            <span className="label">Confirmed</span>
            <span className="value">{confirmed.count ?? 0}</span>
          </div>
          <div className="stat-card">
            <span className="label">Cancelled</span>
            <span className="value">{cancelled.count ?? 0}</span>
          </div>
          <div className="stat-card">
            <span className="label">Total</span>
            <span className="value">{total.count ?? 0}</span>
          </div>
        </div>

        <h2>Most booked</h2>
        {ranking.length === 0 ? (
          <p className="dashboard-empty">No bookings {periodLabel}.</p>
        ) : (
          <ol className="rank-list">
            {ranking.map(([name, count]) => (
              <li key={name}>
                <span className="rank-name">{name}</span>
                <span className="rank-count">
                  <strong>{count}</strong> {count === 1 ? "booking" : "bookings"}
                </span>
              </li>
            ))}
          </ol>
        )}
      </main>
    </>
  );
}
