import Link from "next/link";
import AdminHeader from "@/components/AdminHeader";
import AdminRescheduleBooking from "@/components/AdminRescheduleBooking";
import { supabaseAdmin } from "@/lib/supabase";
import { durationMinutesForTreatmentId } from "@/lib/services";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Params = Promise<{ id: string }>;

function longDate(d: string): string {
  return new Date(d + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function AdminReschedulePage({
  params,
}: {
  params: Params;
}) {
  const { id } = await params;
  const backHref = `/admin/bookings/${id}`;

  if (!supabaseAdmin) {
    return (
      <>
        <AdminHeader active="bookings" />
        <main className="admin-main">
          <h1>Reschedule</h1>
          <p className="lede">Supabase isn&apos;t configured yet.</p>
        </main>
      </>
    );
  }

  const { data: booking } = await supabaseAdmin
    .from("bookings")
    .select(
      "id, treatment_id, treatment_name, duration_minutes, booking_date, booking_time, status"
    )
    .eq("id", id)
    .maybeSingle();

  if (!booking || booking.status === "cancelled") {
    return (
      <>
        <AdminHeader active="bookings" />
        <main className="admin-main">
          <p style={{ marginBottom: 8 }}>
            <Link href={backHref} className="admin-back-link">
              ← Back to booking
            </Link>
          </p>
          <h1>Booking unavailable</h1>
          <p className="lede">
            This booking can&apos;t be rescheduled. It may have been cancelled
            or no longer exists.
          </p>
        </main>
      </>
    );
  }

  const duration =
    (booking.duration_minutes as number | null) ??
    durationMinutesForTreatmentId(booking.treatment_id as string) ??
    60;

  return (
    <>
      <AdminHeader active="bookings" />
      <main className="admin-main">
        <p style={{ marginBottom: 8 }}>
          <Link href={backHref} className="admin-back-link">
            ← Back to booking
          </Link>
        </p>
        <h1 style={{ fontFamily: "var(--font-serif)" }}>Reschedule booking</h1>
        <AdminRescheduleBooking
          bookingId={booking.id}
          treatmentName={booking.treatment_name}
          durationMinutes={duration}
          currentDateLabel={longDate(booking.booking_date as string)}
          currentTime={(booking.booking_time as string).slice(0, 5)}
        />
      </main>
    </>
  );
}
