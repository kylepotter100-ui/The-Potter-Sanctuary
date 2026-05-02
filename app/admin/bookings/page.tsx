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

type SearchParams = Promise<{
  status?: string;
  from?: string;
  to?: string;
  q?: string;
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

function isoDateRegex(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const status = (params.status as Status | undefined) ?? "active";
  const from = params.from && isoDateRegex(params.from) ? params.from : "";
  const to = params.to && isoDateRegex(params.to) ? params.to : "";
  const q = (params.q ?? "").trim();

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

  if (from) query = query.gte("booking_date", from);
  if (to) query = query.lte("booking_date", to);

  if (q) {
    // Match against name (first/last) or email — case-insensitive.
    const escaped = q.replace(/[%,]/g, "");
    query = query.or(
      `customer_first_name.ilike.%${escaped}%,customer_last_name.ilike.%${escaped}%,customer_email.ilike.%${escaped}%`
    );
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
