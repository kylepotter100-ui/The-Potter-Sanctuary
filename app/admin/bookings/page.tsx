import AdminHeader from "@/components/AdminHeader";
import BookingActions from "@/components/BookingActions";
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

export default async function BookingsPage() {
  if (!supabaseAdmin) {
    return (
      <>
        <AdminHeader active="bookings" />
        <main className="admin-main">
          <h1>Bookings</h1>
          <p className="lede">Supabase isn't configured yet.</p>
        </main>
      </>
    );
  }

  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select(
      "id, customer_first_name, customer_last_name, customer_email, customer_phone, treatment_id, treatment_name, treatment_price, booking_date, booking_time, status"
    )
    .order("booking_date", { ascending: false })
    .order("booking_time", { ascending: false });

  const rows = (data ?? []) as Booking[];

  return (
    <>
      <AdminHeader active="bookings" />
      <main className="admin-main">
        <h1>Bookings</h1>
        <p className="lede">
          Every reservation, newest first. Use the actions to confirm or cancel.
        </p>

        {error && (
          <div className="error-text">Couldn't load bookings: {error.message}</div>
        )}

        {rows.length === 0 ? (
          <div className="admin-card">No bookings yet.</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Time</th>
                <th>Name</th>
                <th>Treatment</th>
                <th>Price</th>
                <th>Phone</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id}>
                  <td data-label="Date">{formatDate(b.booking_date)}</td>
                  <td data-label="Time">{formatTime(b.booking_time)}</td>
                  <td data-label="Name">
                    {b.customer_first_name} {b.customer_last_name}
                    <br />
                    <small style={{ opacity: 0.65 }}>{b.customer_email}</small>
                  </td>
                  <td data-label="Treatment">{b.treatment_name}</td>
                  <td data-label="Price">£{b.treatment_price}</td>
                  <td data-label="Phone">{b.customer_phone}</td>
                  <td data-label="Status">
                    <span className={`badge badge-${b.status}`}>{b.status}</span>
                  </td>
                  <td data-label="Actions">
                    <BookingActions bookingId={b.id} current={b.status} />
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
