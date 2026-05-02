import AdminHeader from "@/components/AdminHeader";
import AvailabilityPanel from "@/components/AvailabilityPanel";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AvailabilityPage() {
  if (!supabaseAdmin) {
    return (
      <>
        <AdminHeader active="availability" />
        <main className="admin-main">
          <h1>Availability</h1>
          <p className="lede">
            Supabase isn&apos;t configured yet — set the env vars and run the
            schema.
          </p>
        </main>
      </>
    );
  }

  // Pull a 60-day window of upcoming bookings so the day view can show
  // "Booked by [first name]" badges for already-taken slots.
  const todayIso = new Date().toISOString().slice(0, 10);
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 60);
  const horizonIso = horizon.toISOString().slice(0, 10);

  const [
    { data: availability },
    { data: blocked },
    { data: bookings },
  ] = await Promise.all([
    supabaseAdmin
      .from("availability")
      .select("id, day_of_week, slot_time, is_active")
      .order("day_of_week", { ascending: true })
      .order("slot_time", { ascending: true }),
    supabaseAdmin
      .from("blocked_dates")
      .select("id, blocked_date, reason")
      .order("blocked_date", { ascending: true }),
    supabaseAdmin
      .from("bookings")
      .select("id, booking_date, booking_time, customer_first_name, status")
      .gte("booking_date", todayIso)
      .lte("booking_date", horizonIso)
      .in("status", ["pending", "confirmed"]),
  ]);

  return (
    <>
      <AdminHeader active="availability" />
      <main className="admin-main">
        <h1>Availability</h1>
        <p className="lede">Manage opening hours and blackout dates.</p>
        <AvailabilityPanel
          availability={availability ?? []}
          blocked={blocked ?? []}
          bookings={bookings ?? []}
        />
      </main>
    </>
  );
}
