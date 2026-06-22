import Link from "next/link";
import AdminHeader from "@/components/AdminHeader";
import AdminNewBooking, {
  type InitialClient,
} from "@/components/AdminNewBooking";
import { supabaseAdmin } from "@/lib/supabase";
import { getClientProfile } from "@/lib/clients";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SearchParams = Promise<{ client?: string }>;

export default async function NewBookingPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { client } = await searchParams;

  let initialClient: InitialClient | null = null;
  if (client && supabaseAdmin) {
    const p = await getClientProfile(supabaseAdmin, client);
    if (p) {
      initialClient = {
        id: p.customer.id,
        fname: p.customer.first_name || p.displayName.split(" ")[0] || "",
        lname:
          p.customer.last_name ||
          p.displayName.split(" ").slice(1).join(" ") ||
          "",
        email: p.customer.email,
        phone: p.customer.phone_number || "",
        gender: p.customer.gender || null,
        visits: p.stats.visits,
        hasQuestionnaire: !!p.consultation,
      };
    }
  }

  return (
    <>
      <AdminHeader active="bookings" />
      <main className="admin-main">
        <Link href="/admin/bookings" className="admin-back-link">
          ← Bookings
        </Link>
        <h1 style={{ marginTop: 10 }}>New booking</h1>
        <p className="lede">
          Take a booking for a client who can&apos;t use the website. It&apos;s
          confirmed straight away and the client gets the usual confirmation
          email.
        </p>
        <AdminNewBooking initialClient={initialClient} />
      </main>
    </>
  );
}
