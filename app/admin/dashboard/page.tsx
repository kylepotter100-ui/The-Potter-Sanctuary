import Link from "next/link";
import AdminHeader from "@/components/AdminHeader";
import DashboardMonthNav from "@/components/DashboardMonthNav";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Booking = {
  id: string;
  customer_first_name: string;
  customer_last_name: string;
  treatment_name: string;
  booking_date: string;
  booking_time: string;
  status: "pending" | "confirmed" | "cancelled";
};

type SearchParams = Promise<{ year?: string; month?: string }>;

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

function formatDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatTime(t: string): string {
  return t.slice(0, 5);
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;

  const now = new Date();
  const yearParam = Number(params.year);
  const monthParam = Number(params.month);
  const year = Number.isFinite(yearParam) && yearParam > 1900 ? yearParam : now.getFullYear();
  const month =
    Number.isFinite(monthParam) && monthParam >= 1 && monthParam <= 12
      ? monthParam
      : now.getMonth() + 1;

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

  const monthStart = startOfMonthIso(year, month);
  const monthEnd = endOfMonthIso(year, month);

  // If the selected month is the current month or in the future, show
  // upcoming-from-today bookings within the month. If it's a past month,
  // show all bookings that occurred that month.
  const todayIso = new Date().toISOString().slice(0, 10);
  const isCurrent = year === now.getFullYear() && month === now.getMonth() + 1;
  const isFuture =
    year > now.getFullYear() ||
    (year === now.getFullYear() && month > now.getMonth() + 1);
  const listFrom = isCurrent ? todayIso : monthStart;
  const listTitle = isFuture
    ? "Bookings this month"
    : isCurrent
      ? "Upcoming this month"
      : "Bookings that month";

  const [pending, confirmed, cancelled, total, list] = await Promise.all([
    supabaseAdmin
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .gte("booking_date", monthStart)
      .lte("booking_date", monthEnd),
    supabaseAdmin
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("status", "confirmed")
      .gte("booking_date", monthStart)
      .lte("booking_date", monthEnd),
    supabaseAdmin
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("status", "cancelled")
      .gte("booking_date", monthStart)
      .lte("booking_date", monthEnd),
    supabaseAdmin
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .gte("booking_date", monthStart)
      .lte("booking_date", monthEnd),
    supabaseAdmin
      .from("bookings")
      .select(
        "id, customer_first_name, customer_last_name, treatment_name, booking_date, booking_time, status"
      )
      .gte("booking_date", listFrom)
      .lte("booking_date", monthEnd)
      .order("booking_date", { ascending: true })
      .order("booking_time", { ascending: true }),
  ]);

  const rows = (list.data ?? []) as Booking[];

  return (
    <>
      <AdminHeader active="dashboard" />
      <main className="admin-main">
        <h1>Dashboard</h1>
        <p className="lede">An at-a-glance view of the studio.</p>

        <DashboardMonthNav year={year} month={month} />

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

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 14,
            marginTop: 24,
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <h2 style={{ margin: 0 }}>{listTitle}</h2>
          <div className="btn-row">
            <Link href="/admin/bookings" className="btn btn-ghost btn-sm">
              All bookings
            </Link>
            <Link
              href="/admin/availability"
              className="btn btn-ghost btn-sm"
            >
              Availability
            </Link>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="admin-card">No bookings to show for this month.</div>
        ) : (
          <table className="admin-table admin-table-clickable">
            <thead>
              <tr>
                <th>Date</th>
                <th>Time</th>
                <th>Name</th>
                <th>Treatment</th>
                <th>Status</th>
                <th aria-hidden="true"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id} className={`row-${b.status} row-link`}>
                  <td data-label="Date">
                    <Link
                      href={`/admin/bookings/${b.id}`}
                      className="row-link-target"
                    >
                      {formatDate(b.booking_date)}
                    </Link>
                  </td>
                  <td data-label="Time">{formatTime(b.booking_time)}</td>
                  <td data-label="Name">
                    {b.customer_first_name} {b.customer_last_name}
                  </td>
                  <td data-label="Treatment">{b.treatment_name}</td>
                  <td data-label="Status">
                    <span className={`badge badge-${b.status}`}>
                      {b.status}
                    </span>
                  </td>
                  <td data-label="" className="row-link-arrow">
                    <Link href={`/admin/bookings/${b.id}`}>Manage →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>
    </>
  );
}
