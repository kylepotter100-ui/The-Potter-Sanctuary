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
            Supabase isn't configured yet — set the env vars and run the schema.
          </p>
        </main>
      </>
    );
  }

  const [{ data: availability }, { data: blocked }] = await Promise.all([
    supabaseAdmin
      .from("availability")
      .select("id, day_of_week, slot_time, is_active")
      .order("day_of_week", { ascending: true })
      .order("slot_time", { ascending: true }),
    supabaseAdmin
      .from("blocked_dates")
      .select("id, blocked_date, reason")
      .order("blocked_date", { ascending: true }),
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
        />
      </main>
    </>
  );
}
