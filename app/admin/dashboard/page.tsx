import Link from "next/link";
import AdminHeader from "@/components/AdminHeader";
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

function startOfMonthIso(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function plusDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
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

export default async function DashboardPage() {
  if (!supabaseAdmin) {
    return (
      <>
        <AdminHeader active="dashboard" />
        <main className="admin-main">
          <h1>Dashboard</h1>
          <p className="lede">
            Supabase isn't configured yet — set <code>NEXT_PUBLIC_SUPABASE_URL</code>{" "}
            and <code>SUPABASE_SERVICE_ROLE_KEY</code> in your environment, then
            run the SQL in <code>/supabase/schema.sql</code>.
          </p>
        </main>
      </>
    );
  }

  const monthStart = startOfMonthIso();
  const today = todayIso();
  const sevenDaysAhead = plusDaysIso(7);

  const [pending, confirmedThisMonth, totalThisMonth, upcoming] = await Promise.all([
    supabaseAdmin
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabaseAdmin
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("status", "confirmed")
      .gte("booking_date", monthStart),
    supabaseAdmin
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .gte("booking_date", monthStart),
    supabaseAdmin
      .from("bookings")
      .select(
        "id, customer_first_name, customer_last_name, treatment_name, booking_date, booking_time, status"
      )
      .gte("booking_date", today)
      .lt("booking_date", sevenDaysAhead)
      .order("booking_date", { ascending: true })
      .order("booking_time", { ascending: true }),
  ]);

  const upcomingRows = (upcoming.data ?? []) as Booking[];

  return (
    <>
      <AdminHeader active="dashboard" />
      <main className="admin-main">
        <h1>Dashboard</h1>
        <p className="lede">An at-a-glance view of the studio's week.</p>

        <div className="stat-row">
          <div className="stat-card">
            <span className="label">Pending bookings</span>
            <span className="value">{pending.count ?? 0}</span>
          </div>
          <div className="stat-card">
            <span className="label">Confirmed this month</span>
            <span className="value">{confirmedThisMonth.count ?? 0}</span>
          </div>
          <div className="stat-card">
            <span className="label">Total this month</span>
            <span className="value">{totalThisMonth.count ?? 0}</span>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14, flexWrap: "wrap", gap: 12 }}>
          <h2 style={{ margin: 0 }}>Next 7 days</h2>
          <div className="btn-row">
            <Link href="/admin/bookings" className="btn btn-ghost btn-sm">All bookings</Link>
            <Link href="/admin/availability" className="btn btn-ghost btn-sm">Availability</Link>
          </div>
        </div>

        {upcomingRows.length === 0 ? (
          <div className="admin-card">No bookings in the next seven days.</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Time</th>
                <th>Name</th>
                <th>Treatment</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {upcomingRows.map((b) => (
                <tr key={b.id} className={`row-${b.status}`}>
                  <td data-label="Date">{formatDate(b.booking_date)}</td>
                  <td data-label="Time">{formatTime(b.booking_time)}</td>
                  <td data-label="Name">
                    {b.customer_first_name} {b.customer_last_name}
                  </td>
                  <td data-label="Treatment">{b.treatment_name}</td>
                  <td data-label="Status">
                    <span className={`badge badge-${b.status}`}>{b.status}</span>
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
