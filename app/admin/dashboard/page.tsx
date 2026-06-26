import Link from "next/link";
import AdminHeader from "@/components/AdminHeader";
import DashboardMonthNav from "@/components/DashboardMonthNav";
import ExportBookingsButton from "@/components/ExportBookingsButton";
import { supabaseAdmin } from "@/lib/supabase";
import { ukYearMonth, ukWallTimeToUtc, addDaysIso } from "@/lib/uk-time";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SearchParams = Promise<{ year?: string; month?: string; view?: string }>;

type RevenueRow = { treatment_price: number; booking_date: string };
type PopularityRow = { treatment_name: string };
type RatingRow = { rating: number };
type VoucherRevenueRow = { value: number; created_at: string };

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
function formatRate(r: number): string {
  return `${Math.round(r * 100)}%`;
}

// Percentage change cur-vs-prev, or null when there's no prior-period baseline
// (the launch reality — rendered as "New", never NaN/Infinity).
function pctDelta(cur: number, prev: number): number | null {
  if (!prev) return null;
  return Math.round(((cur - prev) / prev) * 100);
}

// Small trend chip. `adverseUp` flips the colour semantics (e.g. a rising
// cancellation rate is bad). No client JS — pure server markup.
function Delta({
  pct,
  adverseUp = false,
}: {
  pct: number | null;
  adverseUp?: boolean;
}) {
  if (pct === null) return <span className="delta is-new">New</span>;
  if (pct === 0) {
    return (
      <span className="delta is-flat">
        <span className="delta-arrow">→</span> 0%
      </span>
    );
  }
  const up = pct > 0;
  const good = adverseUp ? !up : up;
  return (
    <span className={`delta ${good ? "is-good" : "is-adverse"}`}>
      <span className="delta-arrow">{up ? "▲" : "▼"}</span> {Math.abs(pct)}%
    </span>
  );
}

function StarIcon() {
  return (
    <svg className="kpi-star" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.5l2.9 5.9 6.5.95-4.7 4.58 1.1 6.47L12 17.9l-5.8 3.05 1.1-6.47L2.6 9.9l6.5-.95L12 2.5z" />
    </svg>
  );
}

// "This month"/"this year" defaults use ukYearMonth() from @/lib/uk-time
// (Europe/London, regardless of server timezone).

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;

  const ukNow = ukYearMonth();
  const yearParam = Number(params.year);
  const monthParam = Number(params.month);
  const year =
    Number.isFinite(yearParam) && yearParam > 1900 ? yearParam : ukNow.year;
  const month =
    Number.isFinite(monthParam) && monthParam >= 1 && monthParam <= 12
      ? monthParam
      : ukNow.month;
  // Year is the default at-a-glance view; Month is an opt-in filter.
  const view = params.view === "month" ? "month" : "year";

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

  // Current period bounds follow the month/year toggle.
  const periodStart =
    view === "year" ? isoDate(year, 1, 1) : startOfMonthIso(year, month);
  const periodEnd =
    view === "year" ? isoDate(year, 12, 31) : endOfMonthIso(year, month);

  // Previous comparable period (prior year, or prior month with Dec→Jan rollover).
  const prevYear = view === "year" ? year - 1 : month === 1 ? year - 1 : year;
  const prevMonth = view === "year" ? 12 : month === 1 ? 12 : month - 1;
  const prevStart =
    view === "year" ? isoDate(prevYear, 1, 1) : startOfMonthIso(prevYear, prevMonth);
  const prevEnd =
    view === "year"
      ? isoDate(prevYear, 12, 31)
      : endOfMonthIso(prevYear, prevMonth);
  const prevLabel =
    view === "year" ? String(prevYear) : `${MONTHS_SHORT[prevMonth - 1]} ${prevYear}`;

  // reviews.created_at is timestamptz — bound it by the period's UK wall-time
  // edges converted to real UTC instants, never a bare date string (UTC-vs-UK
  // drift; see lib/uk-time.ts). [start 00:00, dayAfterEnd 00:00).
  const reviewsFromUtc = ukWallTimeToUtc(periodStart, "00:00").toISOString();
  const reviewsToUtc = ukWallTimeToUtc(addDaysIso(periodEnd, 1), "00:00").toISOString();
  // Vouchers carry a timestamptz created_at — bound it the same way (the
  // current period + the previous period for the trend delta).
  const prevFromUtc = ukWallTimeToUtc(prevStart, "00:00").toISOString();
  const prevToUtc = ukWallTimeToUtc(addDaysIso(prevEnd, 1), "00:00").toISOString();

  const [
    pending,
    confirmed,
    cancelled,
    total,
    revenueRes,
    popularityRes,
    prevConfirmed,
    prevRevenueRes,
    reviewsRes,
    vouchersRes,
    prevVouchersRes,
  ] = await Promise.all([
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
    // Previous period — just what the deltas need.
    supabaseAdmin
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("status", "confirmed")
      .gte("booking_date", prevStart)
      .lte("booking_date", prevEnd),
    supabaseAdmin
      .from("bookings")
      .select("treatment_price")
      .eq("status", "confirmed")
      .gte("booking_date", prevStart)
      .lte("booking_date", prevEnd),
    // Reviews in-period (rating only). Behind REVIEWS_ENABLED — empty at launch;
    // tolerate a read error (table may not be present yet) and fall back to none.
    supabaseAdmin
      .from("reviews")
      .select("rating")
      .gte("created_at", reviewsFromUtc)
      .lt("created_at", reviewsToUtc),
    // Vouchers issued in-period — revenue is captured at CREATION (paid offline
    // when the owner makes the voucher), so no status filter. Tolerate a read
    // error (e.g. pre-migration) and fall back to none.
    supabaseAdmin
      .from("vouchers")
      .select("value, created_at")
      .gte("created_at", reviewsFromUtc)
      .lt("created_at", reviewsToUtc),
    supabaseAdmin
      .from("vouchers")
      .select("value")
      .gte("created_at", prevFromUtc)
      .lt("created_at", prevToUtc),
  ]);

  const revenueRows = (revenueRes.data ?? []) as RevenueRow[];
  const popularityRows = (popularityRes.data ?? []) as PopularityRow[];
  const prevRevenueRows = (prevRevenueRes.data ?? []) as { treatment_price: number }[];
  const ratingRows = (reviewsRes.error ? [] : reviewsRes.data ?? []) as RatingRow[];
  const voucherRows = (vouchersRes.error ? [] : vouchersRes.data ?? []) as VoucherRevenueRow[];
  const prevVoucherRows = (prevVouchersRes.error ? [] : prevVouchersRes.data ?? []) as { value: number }[];

  if (reviewsRes.error) {
    console.error("[admin dashboard] reviews read failed", reviewsRes.error);
  }
  if (vouchersRes.error) {
    console.error("[admin dashboard] vouchers read failed", vouchersRes.error);
  }

  const confirmedCount = confirmed.count ?? 0;
  const pendingCount = pending.count ?? 0;
  const cancelledCount = cancelled.count ?? 0;
  const totalCount = total.count ?? 0;
  const prevConfirmedCount = prevConfirmed.count ?? 0;

  // Booking revenue (confirmed list prices) — drives Avg booking.
  const bookingsRevenue = revenueRows.reduce(
    (sum, r) => sum + (r.treatment_price ?? 0),
    0
  );
  const prevBookingsRevenue = prevRevenueRows.reduce(
    (sum, r) => sum + (r.treatment_price ?? 0),
    0
  );
  // Voucher revenue (value of vouchers issued in-period), captured at creation.
  const vouchersRevenue = voucherRows.reduce((sum, r) => sum + (r.value ?? 0), 0);
  const prevVouchersRevenue = prevVoucherRows.reduce((sum, r) => sum + (r.value ?? 0), 0);
  const vouchersCount = voucherRows.length;

  // Headline revenue = confirmed bookings + vouchers issued.
  const revenueTotal = bookingsRevenue + vouchersRevenue;
  const prevRevenueTotal = prevBookingsRevenue + prevVouchersRevenue;

  // Divide-by-zero guarded — null renders as "—", never NaN/Infinity. Avg booking
  // uses bookings-only revenue (vouchers aren't bookings).
  const avgBookingValue = confirmedCount ? bookingsRevenue / confirmedCount : null;
  const prevAvgBooking = prevConfirmedCount
    ? prevBookingsRevenue / prevConfirmedCount
    : null;
  const confirmationRate = totalCount ? confirmedCount / totalCount : null;
  const cancellationRate = totalCount ? cancelledCount / totalCount : null;

  const reviewCount = ratingRows.length;
  const avgRating = reviewCount
    ? ratingRows.reduce((s, r) => s + (r.rating ?? 0), 0) / reviewCount
    : null;

  const revenueDelta = pctDelta(revenueTotal, prevRevenueTotal);
  const avgBookingDelta =
    avgBookingValue !== null && prevAvgBooking
      ? pctDelta(avgBookingValue, prevAvgBooking)
      : null;

  // Per-month confirmed revenue (year mode only).
  const perMonth = Array.from({ length: 12 }, () => 0);
  if (view === "year") {
    for (const r of revenueRows) {
      const m = Number(r.booking_date.slice(5, 7));
      if (m >= 1 && m <= 12) perMonth[m - 1] += r.treatment_price ?? 0;
    }
    for (const r of voucherRows) {
      const m = Number(r.created_at.slice(5, 7));
      if (m >= 1 && m <= 12) perMonth[m - 1] += r.value ?? 0;
    }
  }
  const maxMonth = Math.max(0, ...perMonth);
  const peakIdx = maxMonth > 0 ? perMonth.indexOf(maxMonth) : -1;
  const hasMonthData = maxMonth > 0;

  // Most-booked ranking, top 5.
  const tally = new Map<string, number>();
  for (const r of popularityRows) {
    tally.set(r.treatment_name, (tally.get(r.treatment_name) ?? 0) + 1);
  }
  const ranking = [...tally.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const topCount = ranking.length ? ranking[0][1] : 0;

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

        {/* Revenue headline */}
        <div className="stat-hero">
          <div className="hero-top">
            <span className="label">Revenue</span>
            {revenueDelta !== null && (
              <span className="hero-delta">
                <Delta pct={revenueDelta} />
                <span className="hero-delta-sub">vs {prevLabel}</span>
              </span>
            )}
          </div>
          <span className="value">{formatMoney(revenueTotal)}</span>
          <span className="caption">Confirmed bookings + vouchers · list price</span>
          {vouchersRevenue > 0 && (
            <span className="caption">incl. {formatMoney(vouchersRevenue)} from vouchers</span>
          )}
        </div>

        {/* Booking status */}
        <div className="status-strip">
          <div className="status-cell is-confirmed">
            <span className="label">Confirmed</span>
            <span className="value">{confirmedCount}</span>
          </div>
          <div className="status-cell">
            <span className="label">Pending</span>
            <span className="value">{pendingCount}</span>
          </div>
          <div className="status-cell">
            <span className="label">Cancelled</span>
            <span className="value">{cancelledCount}</span>
          </div>
        </div>

        {/* KPI tiles */}
        <div className="kpi-grid">
          <div className="kpi-tile">
            <span className="label">Avg booking</span>
            <div className="kpi-val-row">
              <span className={`value${avgBookingValue === null ? " is-empty" : ""}`}>
                {avgBookingValue === null ? "—" : formatMoney(avgBookingValue)}
              </span>
              {avgBookingDelta !== null ? (
                <Delta pct={avgBookingDelta} />
              ) : (
                <span className="kpi-sub">per booking</span>
              )}
            </div>
          </div>
          <div className="kpi-tile">
            <span className="label">Confirmation</span>
            <div className="kpi-val-row">
              <span className={`value${confirmationRate === null ? " is-empty" : ""}`}>
                {confirmationRate === null ? "—" : formatRate(confirmationRate)}
              </span>
              <span className="kpi-sub">rate</span>
            </div>
          </div>
          <div className="kpi-tile">
            <span className="label">Cancellation</span>
            <div className="kpi-val-row">
              <span className={`value${cancellationRate === null ? " is-empty" : ""}`}>
                {cancellationRate === null ? "—" : formatRate(cancellationRate)}
              </span>
              <span className="kpi-sub">rate</span>
            </div>
          </div>
          <Link href="/admin/reviews" className="kpi-tile kpi-tile-link">
            <span className="label">
              Avg rating
              <span className="kpi-link-cue" aria-hidden="true">View all →</span>
            </span>
            <div className="kpi-val-row">
              <span className={`value${avgRating === null ? " is-empty" : ""}`}>
                {avgRating === null ? "—" : avgRating.toFixed(1)}
              </span>
              {avgRating !== null && <StarIcon />}
              <span className="kpi-sub">
                {reviewCount === 0
                  ? "No reviews yet"
                  : `${reviewCount} ${reviewCount === 1 ? "review" : "reviews"}`}
              </span>
            </div>
          </Link>
        </div>

        {view === "year" && (
          <section className="dash-section">
            <h2 className="dash-h2">Revenue by month</h2>
            {hasMonthData ? (
              <div className="month-chart">
                {perMonth.map((amt, i) => (
                  <div
                    className="mc-col"
                    key={MONTHS_SHORT[i]}
                    title={`${MONTHS_SHORT[i]} · ${formatMoney(amt)}`}
                  >
                    <div className="mc-bar-wrap">
                      <div
                        className={`mc-bar${i === peakIdx ? " is-peak" : ""}`}
                        style={{ height: `${(amt / maxMonth) * 100}%` }}
                      />
                    </div>
                    <span className="mc-label">{MONTHS_SHORT[i][0]}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="month-empty">No confirmed revenue {periodLabel}.</div>
            )}
          </section>
        )}

        <section className="dash-section">
          <h2 className="dash-h2">Most booked</h2>
          {ranking.length === 0 && vouchersCount === 0 ? (
            <p className="dashboard-empty">No bookings {periodLabel}.</p>
          ) : (
            <>
              {ranking.length > 0 && (
                <ol className="rank-list">
                  {ranking.map(([name, count]) => (
                    <li key={name}>
                      <div className="rank-row">
                        <span className="rank-name">{name}</span>
                        <span className="rank-count">
                          <strong>{count}</strong> {count === 1 ? "booking" : "bookings"}
                        </span>
                      </div>
                      <div className="rank-track">
                        <div
                          className="rank-fill"
                          style={{ width: `${topCount ? (count / topCount) * 100 : 0}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ol>
              )}
              {vouchersCount > 0 && (
                <div className="rank-row voucher-rank-row">
                  <span className="rank-name">Vouchers</span>
                  <span className="rank-count">
                    <strong>{vouchersCount}</strong> issued
                  </span>
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </>
  );
}
