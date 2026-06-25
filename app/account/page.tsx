import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";
import SignOutButton from "@/components/SignOutButton";
import CancelBookingButton from "@/components/CancelBookingButton";
import { ukTodayIso, ukWallTimeToUtc } from "@/lib/uk-time";

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
  treatment_price: number | null;
  duration_minutes: number | null;
  booking_date: string;
  booking_time: string;
  status: "pending" | "confirmed" | "cancelled";
};

type ConsultRow = { booking_id: string | null };

type SearchParams = Promise<{ cancelled?: string; rescheduled?: string }>;

export default async function AccountPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const sp = searchParams
    ? await searchParams
    : ({} as { cancelled?: string; rescheduled?: string });
  const justCancelled = sp.cancelled === "1";
  const justRescheduled = sp.rescheduled === "1";
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

  const todayIso = ukTodayIso();

  let upcoming: BookingRow[] = [];
  let past: BookingRow[] = [];
  let consults: ConsultRow[] = [];
  if (customer) {
    const { data: bookings } = await supabaseAdmin
      .from("bookings")
      .select(
        "id, treatment_name, treatment_price, duration_minutes, booking_date, booking_time, status"
      )
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
        {justRescheduled && (
          <div role="status" className="account-toast">
            Your booking has been rescheduled.
          </div>
        )}
        <header className="account-header">
          <div>
            <h1>Welcome back, {displayName}.</h1>
            <div className="email">{user.email}</div>
          </div>
          <div className="account-actions">
            <Link href="/account/profile" className="btn btn-ghost btn-sm">
              Edit profile
            </Link>
            <SignOutButton className="btn btn-ghost btn-sm" />
          </div>
        </header>
        <p className="acct-sub">
          View, reschedule, or cancel your bookings below. We ask for at least
          12 hours&apos; notice.
        </p>

        <div className="sec-title">Upcoming visits</div>
        {upcoming.length === 0 ? (
          <p className="account-empty">
            No upcoming visits. <Link href="/#booking">Book a session →</Link>
          </p>
        ) : (
          upcoming.map((b) => {
            const done = consultedBookingIds.has(b.id);
            return (
              <div className="bk" key={b.id}>
                <div>
                  <div className="bk-when">
                    {formatDate(b.booking_date)} · {formatTime(b.booking_time)}
                  </div>
                  <div className="bk-treat">{b.treatment_name}</div>
                  <div className="bk-meta">
                    <span
                      className={`pill ${
                        b.status === "confirmed"
                          ? "pill-confirmed"
                          : "pill-pending"
                      }`}
                    >
                      {b.status === "confirmed" ? "Confirmed" : "Pending"}
                    </span>
                    {b.duration_minutes ? `${b.duration_minutes} min` : null}
                    {b.duration_minutes && b.treatment_price != null
                      ? " · "
                      : null}
                    {b.treatment_price != null ? `£${b.treatment_price}` : null}
                  </div>
                </div>
                <div className="bk-right">
                  {done ? (
                    <span className="pill pill-consult-ok">
                      ✓ Consultation on file
                    </span>
                  ) : (
                    <span className="pill pill-consult-no">
                      ⏳ Consultation due
                    </span>
                  )}
                  <div className="bk-actions">
                    {!done && (
                      <Link
                        href={`/questionnaire?booking=${b.id}`}
                        className="btn btn-ghost btn-sm"
                      >
                        Complete consultation
                      </Link>
                    )}
                    <Link
                      href={`/account/reschedule/${b.id}`}
                      className="btn btn-ghost btn-sm"
                    >
                      Reschedule
                    </Link>
                    <CancelBookingButton
                      bookingId={b.id}
                      treatmentName={b.treatment_name}
                      bookingDate={formatDate(b.booking_date)}
                      bookingTime={formatTime(b.booking_time)}
                      startsAt={ukWallTimeToUtc(
                        b.booking_date,
                        b.booking_time
                      ).toISOString()}
                      triggerClassName="btn btn-danger btn-sm"
                    />
                  </div>
                </div>
              </div>
            );
          })
        )}

        <div className="sec-title">Past visits</div>
        {past.length === 0 ? (
          <p className="account-empty">No past visits yet.</p>
        ) : (
          past.map((b) => {
            const cancelled = b.status === "cancelled";
            return (
              <div className="bk past" key={b.id}>
                <div>
                  <div className="bk-when">
                    {formatDate(b.booking_date)} · {formatTime(b.booking_time)}
                  </div>
                  <div className="bk-treat">
                    {b.treatment_name}
                    {cancelled ? " · cancelled" : ""}
                  </div>
                </div>
                {!cancelled && (
                  <div className="bk-right">
                    <span className="pill pill-consult-ok">✓ Attended</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </main>
  );
}
