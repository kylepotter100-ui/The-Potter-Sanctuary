import Link from "next/link";
import AdminHeader from "@/components/AdminHeader";
import { supabaseAdmin } from "@/lib/supabase";
import { getClientProfile } from "@/lib/clients";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Params = Promise<{ id: string }>;

function fmtWhen(dateIso: string, t: string): string {
  const d = new Date(dateIso + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  return `${d} · ${t.slice(0, 5)}`;
}
function fmtMonthYear(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
  });
}
function fmtShortDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso + "T00:00:00").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function ClientProfilePage({ params }: { params: Params }) {
  const { id } = await params;

  if (!supabaseAdmin) {
    return (
      <>
        <AdminHeader active="clients" />
        <main className="admin-main">
          <h1>Client</h1>
          <p className="lede">Supabase isn&apos;t configured yet.</p>
        </main>
      </>
    );
  }

  const profile = await getClientProfile(supabaseAdmin, id);

  if (!profile) {
    return (
      <>
        <AdminHeader active="clients" />
        <main className="admin-main">
          <p style={{ marginBottom: 8 }}>
            <Link href="/admin/clients" className="admin-back-link">
              ← Clients
            </Link>
          </p>
          <h1>Client not found</h1>
        </main>
      </>
    );
  }

  const { customer, displayName, bookings, consultation, reviews, stats } =
    profile;
  const firstName = customer.first_name || displayName.split(" ")[0];
  // So booking-detail / questionnaire "← Back" returns to THIS profile.
  const fromParam = encodeURIComponent(`/admin/clients/${customer.id}`);

  const focusAreas = consultation
    ? ((consultation.focus_areas as string[] | null) ?? [])
    : [];
  const conditions = consultation
    ? ((consultation.conditions as Record<string, boolean> | null) ?? {})
    : {};
  const tickedConditions = Object.entries(conditions)
    .filter(([, v]) => v)
    .map(([k]) =>
      k.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())
    );
  const consultBookingId = consultation
    ? (consultation.booking_id as string | null)
    : null;

  return (
    <>
      <AdminHeader active="clients" />
      <main className="admin-main">
        <Link href="/admin/clients" className="admin-back-link">
          ← Clients
        </Link>

        <div className="admin-title-row" style={{ marginTop: 10 }}>
          <div>
            <h1>{displayName}</h1>
            <p className="profile-sub">
              {customer.email}
              {customer.phone_number ? ` · ${customer.phone_number}` : ""}
              {customer.gender ? ` · ${customer.gender}` : ""}
            </p>
          </div>
          <Link href={`/admin/bookings/new?client=${customer.id}`} className="btn">
            + Book for {firstName}
          </Link>
        </div>
        <p className="profile-stats">
          Client since <b>{fmtMonthYear(stats.clientSince)}</b> · <b>{stats.visits}</b>{" "}
          visit{stats.visits === 1 ? "" : "s"} · <b>£{stats.lifetimeSpend}</b>{" "}
          lifetime spend (confirmed)
        </p>

        {/* Booking history */}
        <section className="admin-card" style={{ marginBottom: 16 }}>
          <p className="admin-subheading">Booking history</p>
          {bookings.length === 0 ? (
            <p className="lede" style={{ margin: 0 }}>
              No bookings yet.
            </p>
          ) : (
            <div className="bk-list">
              {bookings.map((b) => (
                <Link
                  key={b.id}
                  href={`/admin/bookings/${b.id}?from=${fromParam}`}
                  className={`bk-card row-${b.status}`}
                >
                  <div className="bk-card-top">
                    <span className="bk-when">
                      {fmtWhen(b.booking_date, b.booking_time)}
                    </span>
                    <span className={`badge badge-${b.status}`}>{b.status}</span>
                  </div>
                  <div className="bk-name" style={{ fontSize: 17 }}>
                    {b.treatment_name}
                  </div>
                  <div className="bk-chips">
                    <span className="bk-treat">£{b.treatment_price}</span>
                    <span className="bk-manage">Open →</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Consultation on file */}
        <section className="admin-card" style={{ marginBottom: 16 }}>
          <p className="admin-subheading">
            Consultation on file{" "}
            {consultation ? (
              <span className="chip chip-ok" style={{ marginLeft: 6 }}>
                ✓ Completed
              </span>
            ) : (
              <span className="chip chip-warn" style={{ marginLeft: 6 }}>
                — Not completed
              </span>
            )}
          </p>
          {!consultation ? (
            <p className="lede" style={{ margin: 0 }}>
              This client hasn&apos;t completed a consultation questionnaire yet.
            </p>
          ) : (
            <>
              <dl className="q-readonly-list">
                <dt>Completed</dt>
                <dd>{fmtShortDate(consultation.consent_date as string | null)}</dd>
                <dt>Pressure</dt>
                <dd>
                  <span className="q-readonly-pill">
                    {(consultation.pressure_preference as string | null) || "—"}
                  </span>
                </dd>
                <dt>Focus areas</dt>
                <dd>{focusAreas.length ? focusAreas.join(", ") : "—"}</dd>
                <dt>Conditions</dt>
                <dd>{tickedConditions.length ? tickedConditions.join(" · ") : "None noted"}</dd>
                <dt>Under medical care</dt>
                <dd>
                  {consultation.under_medical_care === true
                    ? "Yes"
                    : consultation.under_medical_care === false
                      ? "No"
                      : "—"}
                </dd>
              </dl>
              {consultBookingId && (
                <Link
                  href={`/admin/bookings/${consultBookingId}?from=${fromParam}`}
                  className="btn btn-ghost btn-sm"
                  style={{ marginTop: 4 }}
                >
                  View full questionnaire
                </Link>
              )}
            </>
          )}
        </section>

        {/* Reviews */}
        <section className="admin-card" style={{ marginBottom: 0 }}>
          <p className="admin-subheading">Reviews</p>
          {reviews.length === 0 ? (
            <p className="lede" style={{ margin: 0 }}>
              No reviews from this client yet.
            </p>
          ) : (
            <ul className="review-list" style={{ marginBottom: 0 }}>
              {reviews.map((r) => (
                <li key={r.id} className="review-card">
                  <div className="review-card-head">
                    <span className="stars" aria-label={`${r.rating} out of 5`}>
                      {"★".repeat(r.rating)}
                      {"☆".repeat(5 - r.rating)}
                    </span>
                    <span className="review-meta">
                      {new Date(r.created_at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  {r.comment && <p className="review-comment">{r.comment}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
