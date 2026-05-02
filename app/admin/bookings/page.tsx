import Link from "next/link";
import AdminHeader from "@/components/AdminHeader";
import AdminBookingFilters from "@/components/AdminBookingFilters";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Booking = {
  id: string;
  customer_first_name: string;
  customer_last_name: string;
  customer_email: string;
  customer_phone: string;
  treatment_id: string;
  treatment_name: string;
  treatment_price: number;
  booking_date: string;
  booking_time: string;
  status: "pending" | "confirmed" | "cancelled";
};

type ConsultationLink = { booking_id: string | null };

type Status = "active" | "pending" | "confirmed" | "cancelled" | "all";

type Range = "today" | "week" | "month" | "next30" | "";

type SearchParams = Promise<{
  status?: string;
  range?: string;
}>;

function formatDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTime(t: string): string {
  return t.slice(0, 5);
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function rangeBounds(r: Range): { from: string; to: string } | null {
  if (!r) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  if (r === "today") {
    const d = isoDate(now);
    return { from: d, to: d };
  }
  if (r === "week") {
    const monday = new Date(now);
    const dow = monday.getDay();
    const diff = dow === 0 ? -6 : 1 - dow;
    monday.setDate(monday.getDate() + diff);
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    return { from: isoDate(monday), to: isoDate(sunday) };
  }
  if (r === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { from: isoDate(start), to: isoDate(end) };
  }
  if (r === "next30") {
    const end = new Date(now);
    end.setDate(end.getDate() + 30);
    return { from: isoDate(now), to: isoDate(end) };
  }
  return null;
}

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const status = (params.status as Status | undefined) ?? "active";
  const range = (params.range ?? "") as Range;
  const bounds = rangeBounds(range);

  if (!supabaseAdmin) {
    return (
      <>
        <AdminHeader active="bookings" />
        <main className="admin-main">
          <h1>Bookings</h1>
          <p className="lede">Supabase isn&apos;t configured yet.</p>
        </main>
      </>
    );
  }

  let query = supabaseAdmin
    .from("bookings")
    .select(
      "id, customer_first_name, customer_last_name, customer_email, customer_phone, treatment_id, treatment_name, treatment_price, booking_date, booking_time, status"
    )
    .order("booking_date", { ascending: false })
    .order("booking_time", { ascending: false });

  // Status filter. Default ('active') hides cancelled.
  if (status === "active") {
    query = query.in("status", ["pending", "confirmed"]);
  } else if (status === "pending") {
    query = query.eq("status", "pending");
  } else if (status === "confirmed") {
    query = query.eq("status", "confirmed");
  } else if (status === "cancelled") {
    query = query.eq("status", "cancelled");
  }
  // 'all' applies no status filter.

  if (bounds) {
    query = query.gte("booking_date", bounds.from).lte("booking_date", bounds.to);
  }

  const { data, error } = await query;
  const rows = (data ?? []) as Booking[];

  const { data: consults } = await supabaseAdmin
    .from("consultation_responses")
    .select("booking_id");
  const consultedSet = new Set(
    ((consults ?? []) as ConsultationLink[])
      .map((c) => c.booking_id)
      .filter((id): id is string => !!id)
  );

  return (
    <>
      <AdminHeader active="bookings" />
      <main className="admin-main">
        <h1>Bookings</h1>
        <p className="lede">
          Click any row to manage. Cancelled bookings are hidden by default.
        </p>

        <AdminBookingFilters />

        {error && (
          <div className="error-text">
            Couldn&apos;t load bookings: {error.message}
          </div>
        )}

        {rows.length === 0 ? (
          <div className="admin-card">No bookings match these filters.</div>
        ) : (
          <table className="admin-table admin-table-clickable">
            <thead>
              <tr>
                <th>Date</th>
                <th>Time</th>
                <th>Customer</th>
                <th>Treatment</th>
                <th>Status</th>
                <th>Consultation</th>
                <th aria-hidden="true"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => {
                const completed = consultedSet.has(b.id);
                return (
                  <tr
                    key={b.id}
                    className={`row-${b.status} row-link`}
                  >
                    <td data-label="Date">
                      <Link
                        href={`/admin/bookings/${b.id}`}
                        className="row-link-target"
                      >
                        {formatDate(b.booking_date)}
                      </Link>
                    </td>
                    <td data-label="Time">{formatTime(b.booking_time)}</td>
                    <td data-label="Customer">
                      {b.customer_first_name} {b.customer_last_name}
                      <br />
                      <small style={{ opacity: 0.65 }}>{b.customer_email}</small>
                    </td>
                    <td data-label="Treatment">{b.treatment_name}</td>
                    <td data-label="Status">
                      <span className={`badge badge-${b.status}`}>
                        {b.status}
                      </span>
                    </td>
                    <td data-label="Consultation">
                      {completed ? (
                        <span
                          className="badge badge-confirmed"
                          style={{ textDecoration: "none" }}
                        >
                          ✓ Completed
                        </span>
                      ) : (
                        <span
                          className="badge"
                          style={{
                            background: "#f4e3c4",
                            color: "#7a5b1a",
                          }}
                        >
                          ⏳ Pending
                        </span>
                      )}
                    </td>
                    <td data-label="" className="row-link-arrow">
                      <Link
                        href={`/admin/bookings/${b.id}`}
                        aria-label={`Manage booking for ${b.customer_first_name} ${b.customer_last_name}`}
                      >
                        Manage →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </main>
    </>
  );
}
