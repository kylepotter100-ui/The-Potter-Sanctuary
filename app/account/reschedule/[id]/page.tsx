import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";
import { durationMinutesForTreatmentId } from "@/lib/services";
import RescheduleBooking from "@/components/RescheduleBooking";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reschedule — The Potter Sanctuary",
  robots: { index: false, follow: false },
};

type Params = Promise<{ id: string }>;

function longDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function ReschedulePage({ params }: { params: Params }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user || !user.email) {
    redirect(`/login?next=/account/reschedule/${id}`);
  }
  if (!supabaseAdmin) {
    return (
      <main className="account-page">
        <div className="account-shell">
          <h1>Reschedule</h1>
          <p className="account-empty">Supabase isn&apos;t configured yet.</p>
        </div>
      </main>
    );
  }

  const emailLower = user.email.toLowerCase();
  const { data: customer } = await supabaseAdmin
    .from("customers")
    .select("id")
    .eq("email", emailLower)
    .maybeSingle();

  const { data: booking } = await supabaseAdmin
    .from("bookings")
    .select("id, customer_id, treatment_id, treatment_name, duration_minutes, booking_date, booking_time, status")
    .eq("id", id)
    .maybeSingle();

  const ownNotCancelled =
    booking &&
    customer &&
    booking.customer_id === customer.id &&
    booking.status !== "cancelled";

  if (!ownNotCancelled) {
    return (
      <main className="account-page">
        <div className="account-shell">
          <p style={{ marginBottom: 8 }}>
            <Link href="/account" className="account-link">← Back to account</Link>
          </p>
          <h1>Booking unavailable</h1>
          <p className="account-empty">
            This booking can&apos;t be rescheduled. It may have been cancelled or
            belongs to a different account.
          </p>
        </div>
      </main>
    );
  }

  const duration =
    (booking.duration_minutes as number | null) ??
    durationMinutesForTreatmentId(booking.treatment_id as string) ??
    60;

  return (
    <main className="account-page">
      <div className="account-shell">
        <header className="account-header">
          <div>
            <h1>Reschedule your booking</h1>
          </div>
          <div className="account-actions">
            <Link href="/account" className="account-link">← Back to account</Link>
          </div>
        </header>
        <RescheduleBooking
          bookingId={booking.id}
          treatmentName={booking.treatment_name}
          durationMinutes={duration}
          currentDateLabel={longDate(booking.booking_date)}
          currentTime={(booking.booking_time as string).slice(0, 5)}
        />
      </div>
    </main>
  );
}
