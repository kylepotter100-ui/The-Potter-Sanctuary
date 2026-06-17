import AdminHeader from "@/components/AdminHeader";
import AvailabilityPanel from "@/components/AvailabilityPanel";
import { supabaseAdmin } from "@/lib/supabase";
import { HORIZON_DAYS } from "@/lib/availability";
import { addDaysIso, ukTodayIso } from "@/lib/uk-time";

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

  // HORIZON_DAYS ahead covers the next ~8 weeks the admin is realistically
  // managing. Bookings + slot overrides + blocked dates flow through, and the
  // panel caps week navigation to this same window so every reachable date is
  // inside the fetched data (see lib/availability.ts HORIZON_DAYS).
  // UK business date — not server-UTC, which lags an hour during BST.
  const todayIso = ukTodayIso();
  const horizonIso = addDaysIso(todayIso, HORIZON_DAYS);

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
      .select(
        "id, booking_date, booking_time, duration_minutes, treatment_id, customer_first_name, status"
      )
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
          horizonIso={horizonIso}
        />
      </main>
    </>
  );
}
