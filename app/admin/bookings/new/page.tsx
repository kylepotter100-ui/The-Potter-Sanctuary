import Link from "next/link";
import AdminHeader from "@/components/AdminHeader";
import AdminNewBooking, {
  type InitialClient,
} from "@/components/AdminNewBooking";
import { supabaseAdmin } from "@/lib/supabase";
import { getClientProfile } from "@/lib/clients";
import { resolveBack } from "@/lib/admin-back";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SearchParams = Promise<{ client?: string; from?: string }>;

export default async function NewBookingPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { client, from } = await searchParams;
  // Where "← Back" / Cancel / Done return to: explicit ?from= wins; otherwise,
  // if launched from a client profile (?client=), go back there; else Bookings.
  const back = from
    ? resolveBack(from)
    : client
      ? { href: `/admin/clients/${client}`, label: "client" }
      : resolveBack(null);

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
        <Link href={back.href} className="admin-back-link">
          ← Back to {back.label}
        </Link>
        <h1 style={{ marginTop: 10 }}>New booking</h1>
        <p className="lede">
          Take a booking for a client who can&apos;t use the website. It&apos;s
          confirmed straight away and the client gets the usual confirmation
          email.
        </p>
        <AdminNewBooking initialClient={initialClient} returnHref={back.href} />
      </main>
    </>
  );
}
