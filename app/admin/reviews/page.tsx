import Link from "next/link";
import AdminHeader from "@/components/AdminHeader";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ReviewRow = {
  id: string;
  booking_id: string | null;
  rating: number;
  comment: string | null;
  created_at: string;
};
type BookingRow = {
  id: string;
  customer_first_name: string;
  customer_last_name: string;
  treatment_name: string;
  booking_date: string;
};

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// "12 Jun 2026" from a YYYY-MM-DD (or ISO timestamp) — sliced, not Date-parsed,
// so it never drifts with the server's UTC clock.
function fmtDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  const mi = Number(m) - 1;
  if (!y || mi < 0 || mi > 11) return iso.slice(0, 10);
  return `${Number(d)} ${MONTHS_SHORT[mi]} ${y}`;
}

// Five stars, `value` filled (amber), the rest outlined.
function Stars({ value }: { value: number }) {
  const filled = Math.max(0, Math.min(5, Math.round(value)));
  return (
    <span className="review-stars" aria-label={`${filled} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <svg
          key={i}
          viewBox="0 0 24 24"
          className={i < filled ? "is-filled" : ""}
          fill={i < filled ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <path d="M12 2.5l2.9 5.9 6.5.95-4.7 4.58 1.1 6.47L12 17.9l-5.8 3.05 1.1-6.47L2.6 9.9l6.5-.95L12 2.5z" />
        </svg>
      ))}
    </span>
  );
}

export default async function ReviewsPage() {
  if (!supabaseAdmin) {
    return (
      <>
        <AdminHeader active="dashboard" />
        <main className="admin-main">
          <h1>Reviews</h1>
          <p className="lede">Supabase isn&apos;t configured yet.</p>
        </main>
      </>
    );
  }

  const { data: reviewData, error: reviewErr } = await supabaseAdmin
    .from("reviews")
    .select("id, booking_id, rating, comment, created_at")
    .order("created_at", { ascending: false });

  if (reviewErr) {
    console.error("[admin reviews] read failed", reviewErr);
  }
  const reviews = (reviewErr ? [] : reviewData ?? []) as ReviewRow[];

  // Resolve customer names/treatments via booking_id (nullable → "Guest").
  const bookingIds = [...new Set(reviews.map((r) => r.booking_id).filter(Boolean))] as string[];
  const bookingsById = new Map<string, BookingRow>();
  if (bookingIds.length > 0) {
    const { data: bookingData } = await supabaseAdmin
      .from("bookings")
      .select("id, customer_first_name, customer_last_name, treatment_name, booking_date")
      .in("id", bookingIds);
    for (const b of (bookingData ?? []) as BookingRow[]) bookingsById.set(b.id, b);
  }

  const count = reviews.length;
  const avg = count
    ? reviews.reduce((s, r) => s + (r.rating ?? 0), 0) / count
    : null;

  return (
    <>
      <AdminHeader active="dashboard" />
      <main className="admin-main">
        <p style={{ marginBottom: 8 }}>
          <Link href="/admin/dashboard" className="admin-back-link">
            ← Back to dashboard
          </Link>
        </p>
        <h1>Reviews</h1>
        {count === 0 ? (
          <p className="lede">Customer feedback left after appointments.</p>
        ) : (
          <p className="review-summary">
            <Stars value={avg ?? 0} />
            <strong>{avg!.toFixed(1)}</strong>
            <span className="review-summary-count">
              · {count} {count === 1 ? "review" : "reviews"}
            </span>
          </p>
        )}

        {count === 0 ? (
          <div className="admin-card">
            No reviews yet. Feedback appears here once customers review their
            treatment.
          </div>
        ) : (
          <ul className="review-list">
            {reviews.map((r) => {
              const b = r.booking_id ? bookingsById.get(r.booking_id) : undefined;
              const name = b
                ? `${b.customer_first_name} ${b.customer_last_name}`.trim()
                : "Guest";
              const when = b ? b.booking_date : r.created_at;
              return (
                <li key={r.id} className="review-card">
                  <div className="review-card-head">
                    <span className="review-name">{name}</span>
                    <Stars value={r.rating} />
                  </div>
                  {r.comment && <p className="review-comment">{r.comment}</p>}
                  <p className="review-meta">
                    {b ? `${b.treatment_name} · ` : ""}
                    {fmtDate(when)}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </>
  );
}
