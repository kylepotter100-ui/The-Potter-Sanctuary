import Link from "next/link";
import AdminHeader from "@/components/AdminHeader";
import OutstandingReviewsList from "@/components/OutstandingReviewsList";
import { supabaseAdmin } from "@/lib/supabase";
import { listOutstandingReviewClients } from "@/lib/reviews";
import { ukTodayIso } from "@/lib/uk-time";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Outstanding reviews — by-customer chase list of clients with a completed
// session who haven't reviewed. Reached from the banner at the top of Bookings;
// kept separate from /admin/reviews (submitted reviews).
export default async function OutstandingReviewsPage() {
  if (!supabaseAdmin) {
    return (
      <>
        <AdminHeader active="bookings" />
        <main className="admin-main">
          <h1>Outstanding reviews</h1>
          <p className="lede">Supabase isn&apos;t configured yet.</p>
        </main>
      </>
    );
  }

  const clients = await listOutstandingReviewClients(supabaseAdmin, ukTodayIso());

  return (
    <>
      <AdminHeader active="bookings" />
      <main className="admin-main">
        <p style={{ marginBottom: 8 }}>
          <Link href="/admin/bookings" className="admin-back-link">
            ← Back to bookings
          </Link>
        </p>
        <div className="outstanding-title-row">
          <h1>Outstanding reviews</h1>
          <Link
            href="/admin/reviews?from=outstanding"
            className="outstanding-submitted-link"
          >
            Submitted →
          </Link>
        </div>
        <p className="lede">
          {clients.length === 0
            ? "Completed sessions not yet reviewed."
            : `Completed sessions not yet reviewed · ${clients.length} ${
                clients.length === 1 ? "client" : "clients"
              }`}
        </p>

        {clients.length === 0 ? (
          <div className="admin-card outstanding-empty">
            <div className="outstanding-empty-check" aria-hidden="true">
              ✓
            </div>
            <h2>All caught up</h2>
            <p className="lede">
              Every client with a completed session has left a review or already
              been asked.
            </p>
          </div>
        ) : (
          <OutstandingReviewsList clients={clients} />
        )}
      </main>
    </>
  );
}
