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

  // 90-day horizon covers the full window the admin can navigate without
  // a refresh. Bookings + slot overrides + blocked dates all flow through.
  const todayIso = new Date().toISOString().slice(0, 10);
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 90);
  const horizonIso = horizon.toISOString().slice(0, 10);

  const [
    { data: availability },
    { data: blocked },
    { data: bookings },
    { data: overrides, error: overridesErr },
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
    supabaseAdmin
      .from("slot_overrides")
      .select("override_date, slot_time, is_active")
      .gte("override_date", todayIso)
      .lte("override_date", horizonIso),
  ]);

  if (overridesErr) {
    // Phase 4 schema may not be applied yet — surface so the admin notices.
    console.error("[admin avail] slot_overrides read failed", overridesErr);
  }

  return (
    <>
      <AdminHeader active="availability" />
      <main className="admin-main">
        <h1>Availability</h1>
        <p className="lede">Manage opening days, time slots, and blackout dates.</p>
        {overridesErr && (
          <div className="admin-card" style={{ marginBottom: 16 }}>
            <strong>Schema update needed:</strong> the{" "}
            <code>slot_overrides</code> table is missing. Run the SQL in{" "}
            <code>supabase/schema.sql</code> and{" "}
            <code>supabase/rls-policies.sql</code> in the Supabase SQL editor.
          </div>
        )}
        <AvailabilityPanel
          availability={availability ?? []}
          blocked={blocked ?? []}
          bookings={bookings ?? []}
          overrides={overrides ?? []}
        />
      </main>
    </>
  );
}
