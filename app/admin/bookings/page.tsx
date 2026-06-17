import Link from "next/link";
import AdminHeader from "@/components/AdminHeader";
import AdminBookingFilters from "@/components/AdminBookingFilters";
import { supabaseAdmin } from "@/lib/supabase";
import {
  getReviewedIndex,
  reviewStateFor,
  listOutstandingReviewClients,
  type ReviewState,
} from "@/lib/reviews";
import { ukTodayIso } from "@/lib/uk-time";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Booking = {
  id: string;
  customer_first_name: string;
  customer_last_name: string;
  customer_email: string;
  customer_id: string | null;
  treatment_name: string;
  booking_date: string;
  booking_time: string;
  status: "pending" | "confirmed" | "cancelled";
  review_email_sent_at: string | null;
};

type ConsultationLink = { booking_id: string | null };
type Status = "active" | "pending" | "confirmed" | "cancelled" | "all";
type Range = "today" | "week" | "month" | "next30" | "upcoming" | "";

type SearchParams = Promise<{ status?: string; range?: string }>;

// "WED 18 JUN · 14:00" — compact; uppercased via CSS.
function fmtWhen(dateIso: string, t: string): string {
  const d = new Date(dateIso + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  return `${d} · ${t.slice(0, 5)}`;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function rangeBounds(r: Range): { from?: string; to?: string } | null {
  if (!r) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  if (r === "today") {
    const d = isoDate(now);
    return { from: d, to: d };
  }
  if (r === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { from: isoDate(start), to: isoDate(end) };
  }
  if (r === "upcoming") {
    return { from: isoDate(now) };
  }
  // Legacy presets (week/next30) still resolve if linked directly.
  if (r === "week") {
    const monday = new Date(now);
    const dow = monday.getDay();
    monday.setDate(monday.getDate() + (dow === 0 ? -6 : 1 - dow));
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    return { from: isoDate(monday), to: isoDate(sunday) };
  }
  if (r === "next30") {
    const end = new Date(now);
    end.setDate(end.getDate() + 30);
    return { from: isoDate(now), to: isoDate(end) };
  }
  return null;
}

function ReviewChip({ state }: { state: ReviewState }) {
  if (state === "left")
    return <span className="chip chip-rev-left">★ Reviewed</span>;
  if (state === "requested")
    return <span className="chip chip-rev-req">Requested</span>;
  return <span className="chip chip-rev-none">No review</span>;
}

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const status = (params.status as Status | undefined) ?? "active";
  const range = ((params.range as Range | undefined) ?? "upcoming") as Range;
  const bounds = rangeBounds(range);

  if (!supabaseAdmin) {
    return (
      <>
        <AdminHeader active="bookings" />
        <main className="admin-main">
          <h1>Bookings</h1>
          <p className="lede">Supabase isn&apos;t configured yet.</p>
        </main>
      </>
    );
  }

  let query = supabaseAdmin
    .from("bookings")
    .select(
      "id, customer_first_name, customer_last_name, customer_email, customer_id, treatment_name, booking_date, booking_time, status, review_email_sent_at"
    )
    .order("booking_date", { ascending: false })
    .order("booking_time", { ascending: false });

  if (status === "active") query = query.in("status", ["pending", "confirmed"]);
  else if (status === "pending") query = query.eq("status", "pending");
  else if (status === "confirmed") query = query.eq("status", "confirmed");
  else if (status === "cancelled") query = query.eq("status", "cancelled");

  if (bounds) {
    if (bounds.from) query = query.gte("booking_date", bounds.from);
    if (bounds.to) query = query.lte("booking_date", bounds.to);
  }

  const { data, error } = await query;
  const rows = (data ?? []) as Booking[];

  const { data: consults } = await supabaseAdmin
    .from("consultation_responses")
    .select("booking_id");
  const consultedSet = new Set(
    ((consults ?? []) as ConsultationLink[])
      .map((c) => c.booking_id)
      .filter((id): id is string => !!id)
  );

  // Review chips (bulk, one reviews read) + outstanding-reviews banner count.
  const reviewedIndex = await getReviewedIndex(supabaseAdmin);
  const outstanding = await listOutstandingReviewClients(
    supabaseAdmin,
    ukTodayIso()
  );
  const outstandingCount = outstanding.length;

  return (
    <>
      <AdminHeader active="bookings" />
      <main className="admin-main">
        <h1>Bookings</h1>
        <p className="lede">Tap a booking to manage.</p>

        {outstandingCount > 0 && (
          <Link href="/admin/reviews/outstanding" className="review-banner">
            <span className="review-banner-star" aria-hidden="true">
              ★
            </span>
            <span className="review-banner-text">
              <strong>Outstanding reviews</strong>
              <span>
                {outstandingCount}{" "}
                {outstandingCount === 1 ? "client" : "clients"} not yet reviewed
              </span>
            </span>
            <span className="review-banner-cta">Review →</span>
          </Link>
        )}

        <AdminBookingFilters />

        {error && (
          <div className="error-text">
            Couldn&apos;t load bookings: {error.message}
          </div>
        )}

        {rows.length === 0 ? (
          <div className="admin-card">No bookings match this filter.</div>
        ) : (
          <div className="bk-list">
            {rows.map((b) => {
              const completed = consultedSet.has(b.id);
              const rs: ReviewState =
                b.status === "cancelled" ? "none" : reviewStateFor(reviewedIndex, b);
              return (
                <Link
                  key={b.id}
                  href={`/admin/bookings/${b.id}`}
                  className={`bk-card row-${b.status}`}
                  aria-label={`Manage booking for ${b.customer_first_name} ${b.customer_last_name}`}
                >
                  <div className="bk-card-top">
                    <span className="bk-when">
                      {fmtWhen(b.booking_date, b.booking_time)}
                    </span>
                    <span className={`badge badge-${b.status}`}>{b.status}</span>
                  </div>
                  <div className="bk-name">
                    {b.customer_first_name} {b.customer_last_name}
                  </div>
                  <div className="bk-treat">{b.treatment_name}</div>
                  <div className="bk-chips">
                    <span className={`chip ${completed ? "chip-ok" : "chip-warn"}`}>
                      {completed ? "✓ Consult" : "⏳ Consult"}
                    </span>
                    {b.status !== "cancelled" && <ReviewChip state={rs} />}
                    <span className="bk-manage">Manage →</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
