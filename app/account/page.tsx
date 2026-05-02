import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";
import SignOutButton from "@/components/SignOutButton";
import CancelBookingButton from "@/components/CancelBookingButton";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your account — The Potter Sanctuary",
  robots: { index: false, follow: false },
};

function formatDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatTime(t: string): string {
  return t.slice(0, 5);
}

type BookingRow = {
  id: string;
  treatment_name: string;
  booking_date: string;
  booking_time: string;
  status: "pending" | "confirmed" | "cancelled";
};

type ConsultRow = { booking_id: string | null };

type SearchParams = Promise<{ cancelled?: string }>;

export default async function AccountPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const sp = searchParams ? await searchParams : ({} as { cancelled?: string });
  const justCancelled = sp.cancelled === "1";
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user || !user.email) {
    redirect("/login?next=/account");
  }

  if (!supabaseAdmin) {
    return (
      <main className="account-page">
        <div className="account-shell">
          <h1>Your account</h1>
          <p className="account-empty">Supabase isn't configured yet.</p>
        </div>
      </main>
    );
  }

  const emailLower = user.email.toLowerCase();
  const { data: customer } = await supabaseAdmin
    .from("customers")
    .select("id, full_name, first_name, email")
    .eq("email", emailLower)
    .maybeSingle();

  const todayIso = new Date().toISOString().slice(0, 10);

  let upcoming: BookingRow[] = [];
  let past: BookingRow[] = [];
  let consults: ConsultRow[] = [];
  if (customer) {
    const { data: bookings } = await supabaseAdmin
      .from("bookings")
      .select("id, treatment_name, booking_date, booking_time, status")
      .eq("customer_id", customer.id)
      .order("booking_date", { ascending: false })
      .order("booking_time", { ascending: false });
    const all = (bookings ?? []) as BookingRow[];
    upcoming = all
      .filter((b) => b.booking_date >= todayIso && b.status !== "cancelled")
      .reverse();
    past = all.filter(
      (b) => b.booking_date < todayIso || b.status === "cancelled"
    );

    const { data: cons } = await supabaseAdmin
      .from("consultation_responses")
      .select("booking_id")
      .eq("customer_id", customer.id);
    consults = (cons ?? []) as ConsultRow[];
  }

  const consultedBookingIds = new Set(
    consults.map((c) => c.booking_id).filter(Boolean) as string[]
  );

  const displayName =
    customer?.first_name ||
    (customer?.full_name ? customer.full_name.split(" ")[0] : null) ||
    user.email.split("@")[0];

  return (
    <main className="account-page">
      <div className="account-shell">
        {justCancelled && (
          <div role="status" className="account-toast">
            Your booking has been cancelled.
          </div>
        )}
        <header className="account-header">
          <div>
            <h1>Welcome back, {displayName}.</h1>
            <div className="email">{user.email}</div>
          </div>
          <div className="account-actions">
            <Link href="/account/profile" className="account-link">
              Edit profile
            </Link>
            <SignOutButton />
          </div>
        </header>

        <section className="account-section">
          <h2>Upcoming visits</h2>
          {upcoming.length === 0 ? (
            <p className="account-empty">
              No upcoming visits. <Link href="/#booking">Book a session →</Link>
            </p>
          ) : (
            <ul className="account-bookings-list">
              {upcoming.map((b) => {
                const done = consultedBookingIds.has(b.id);
                return (
                  <li key={b.id}>
                    <div>
                      <div className="b-when">
                        {formatDate(b.booking_date)} · {formatTime(b.booking_time)}
                      </div>
                      <div className="b-treatment">{b.treatment_name}</div>
                    </div>
                    <div className="b-actions">
                      {done ? (
                        <span className="badge-consult done">✓ Completed</span>
                      ) : (
                        <Link
                          href={`/questionnaire?booking=${b.id}`}
                          className="submit-btn-link"
                        >
                          Submit consultation
                        </Link>
                      )}
                      <CancelBookingButton
                        bookingId={b.id}
                        treatmentName={b.treatment_name}
                        bookingDate={formatDate(b.booking_date)}
                        bookingTime={formatTime(b.booking_time)}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="account-section">
          <h2>Past visits</h2>
          {past.length === 0 ? (
            <p className="account-empty">No past visits yet.</p>
          ) : (
            <ul className="account-bookings-list">
              {past.map((b) => (
                <li key={b.id}>
                  <div>
                    <div className="b-when">
                      {formatDate(b.booking_date)} · {formatTime(b.booking_time)}
                    </div>
                    <div className="b-treatment">
                      {b.treatment_name}
                      {b.status === "cancelled" ? " · cancelled" : ""}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
