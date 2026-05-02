import Link from "next/link";
import AdminHeader from "@/components/AdminHeader";
import AdminBookingActions from "@/components/AdminBookingActions";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const HEALTH_CONDITIONS: Array<{ key: string; label: string }> = [
  { key: "high_blood_pressure", label: "High blood pressure" },
  { key: "low_blood_pressure", label: "Low blood pressure" },
  { key: "heart_condition", label: "Heart condition" },
  { key: "diabetes", label: "Diabetes" },
  { key: "arthritis", label: "Arthritis" },
  { key: "chronic_pain", label: "Chronic pain" },
  { key: "headaches_migraines", label: "Headaches/Migraines" },
  { key: "recent_injury", label: "Recent injury" },
  { key: "pregnancy", label: "Pregnancy" },
  { key: "skin_conditions", label: "Skin conditions" },
  { key: "allergies", label: "Allergies" },
];

function fmtBool(v: boolean | null): string {
  if (v === null || v === undefined) return "—";
  return v ? "Yes" : "No";
}

function fmtText(v: string | null | undefined): string {
  return v && v.trim() ? v : "—";
}

function fmtLongDate(d: string): string {
  return new Date(d + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function fmtShortDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

type Params = Promise<{ id: string }>;

export default async function AdminBookingDetailPage({
  params,
}: {
  params: Params;
}) {
  const { id } = await params;

  if (!supabaseAdmin) {
    return (
      <>
        <AdminHeader active="bookings" />
        <main className="admin-main">
          <h1>Booking</h1>
          <p className="lede">Supabase isn&apos;t configured yet.</p>
        </main>
      </>
    );
  }

  const { data: booking } = await supabaseAdmin
    .from("bookings")
    .select(
      "id, customer_first_name, customer_last_name, customer_email, customer_phone, customer_gender, treatment_id, treatment_name, treatment_price, booking_date, booking_time, message, status, cancellation_reason, cancelled_at, cancelled_by, customer_id, created_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (!booking) {
    return (
      <>
        <AdminHeader active="bookings" />
        <main className="admin-main">
          <p style={{ marginBottom: 8 }}>
            <Link href="/admin/bookings" className="account-link">
              ← Back to bookings
            </Link>
          </p>
          <h1>Booking not found</h1>
        </main>
      </>
    );
  }

  const { data: consult } = await supabaseAdmin
    .from("consultation_responses")
    .select("*")
    .eq("booking_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const conditions = consult
    ? ((consult.conditions as Record<string, boolean>) ?? {})
    : {};
  const checked = HEALTH_CONDITIONS.filter((c) => conditions[c.key]);
  const focusAreas = consult ? ((consult.focus_areas as string[]) ?? []) : [];

  const canAct = booking.status === "pending" || booking.status === "confirmed";

  return (
    <>
      <AdminHeader active="bookings" />
      <main className="admin-main">
        <p style={{ marginBottom: 8 }}>
          <Link href="/admin/bookings" className="account-link">
            ← Back to bookings
          </Link>
        </p>
        <h1>
          {booking.customer_first_name} {booking.customer_last_name}
        </h1>
        <p className="lede">
          {booking.treatment_name} · {fmtLongDate(booking.booking_date)} at{" "}
          {booking.booking_time.slice(0, 5)}
        </p>

        {/* Section 1 — Booking details */}
        <section className="admin-card" style={{ marginBottom: 16 }}>
          <h2 style={{ fontFamily: "var(--font-serif)", marginTop: 0 }}>
            Booking Details
          </h2>
          <p>
            <strong>Date:</strong> {fmtLongDate(booking.booking_date)}
          </p>
          <p>
            <strong>Time:</strong> {booking.booking_time.slice(0, 5)}
          </p>
          <p>
            <strong>Treatment:</strong> {booking.treatment_name}
          </p>
          <p>
            <strong>Price:</strong> £{booking.treatment_price}
          </p>
          <p>
            <strong>Customer:</strong> {booking.customer_first_name}{" "}
            {booking.customer_last_name}
          </p>
          <p>
            <strong>Email:</strong> {booking.customer_email}
          </p>
          <p>
            <strong>Phone:</strong> {booking.customer_phone}
          </p>
          <p>
            <strong>Gender:</strong> {fmtText(booking.customer_gender)}
          </p>
          <p>
            <strong>Status:</strong>{" "}
            <span className={`badge badge-${booking.status}`}>
              {booking.status}
            </span>
          </p>
          {booking.message && (
            <p>
              <strong>Message:</strong> {booking.message}
            </p>
          )}
          {booking.status === "cancelled" && (
            <>
              <p>
                <strong>Cancelled by:</strong>{" "}
                {fmtText(booking.cancelled_by as string | null)}
              </p>
              <p>
                <strong>Cancelled at:</strong>{" "}
                {booking.cancelled_at
                  ? new Date(booking.cancelled_at as string).toLocaleString(
                      "en-GB"
                    )
                  : "—"}
              </p>
              <p>
                <strong>Reason:</strong>{" "}
                {fmtText(booking.cancellation_reason as string | null)}
              </p>
            </>
          )}
        </section>

        {/* Section 2 — Consultation response */}
        <section className="admin-card" style={{ marginBottom: 16 }}>
          <h2 style={{ fontFamily: "var(--font-serif)", marginTop: 0 }}>
            Consultation Response
          </h2>
          {!consult ? (
            <p className="lede" style={{ margin: 0 }}>
              No consultation submitted yet.
            </p>
          ) : (
            <>
              <h3 className="admin-subheading">Client Information</h3>
              <p>
                <strong>Name:</strong> {booking.customer_first_name}{" "}
                {booking.customer_last_name}
              </p>
              <p>
                <strong>Email:</strong> {booking.customer_email}
              </p>
              <p>
                <strong>Phone:</strong> {booking.customer_phone}
              </p>

              <h3 className="admin-subheading">Health History</h3>
              <p>
                <strong>Conditions:</strong>{" "}
                {checked.length === 0
                  ? "None reported"
                  : checked.map((c) => c.label).join(", ")}
              </p>
              {conditions.allergies && (
                <p>
                  <strong>Allergies (specified):</strong>{" "}
                  {fmtText(consult.allergies_specify as string | null)}
                </p>
              )}
              <p>
                <strong>Other medical conditions:</strong>{" "}
                {fmtText(consult.other_medical_conditions as string | null)}
              </p>
              <p>
                <strong>Currently under medical care:</strong>{" "}
                {fmtBool(consult.under_medical_care as boolean | null)}
              </p>
              {consult.under_medical_care && (
                <p>
                  <strong>Explanation:</strong>{" "}
                  {fmtText(consult.medical_care_explanation as string | null)}
                </p>
              )}

              <h3 className="admin-subheading">Massage Preferences</h3>
              <p>
                <strong>Focus areas:</strong>{" "}
                {focusAreas.length === 0 ? "—" : focusAreas.join(", ")}
              </p>
              <p>
                <strong>Areas to avoid:</strong>{" "}
                {fmtText(consult.areas_to_avoid as string | null)}
              </p>
              <p>
                <strong>Pressure preference:</strong>{" "}
                {fmtText(consult.pressure_preference as string | null)}
              </p>
              <p>
                <strong>Had professional massage before:</strong>{" "}
                {fmtBool(
                  consult.had_professional_massage_before as boolean | null
                )}
              </p>

              <h3 className="admin-subheading">Lifestyle &amp; Wellness</h3>
              <p>
                <strong>Experiences stress regularly:</strong>{" "}
                {fmtBool(consult.experiences_stress_regularly as boolean | null)}
              </p>
              <p>
                <strong>Primary reason for visit:</strong>{" "}
                {fmtText(consult.primary_reason as string | null)}
              </p>
              <p>
                <strong>Additional info:</strong>{" "}
                {fmtText(consult.additional_info as string | null)}
              </p>

              <h3 className="admin-subheading">Consent</h3>
              <p>
                <strong>Consent given:</strong>{" "}
                {fmtBool(consult.consent_given as boolean | null)}
              </p>
              <p>
                <strong>Signed by:</strong>{" "}
                {fmtText(consult.signature_name as string | null)}
              </p>
              <p>
                <strong>Signed on:</strong>{" "}
                {fmtShortDate(consult.consent_date as string | null)}
              </p>
              <p style={{ opacity: 0.6, fontSize: 12 }}>
                Submitted{" "}
                {new Date(consult.created_at as string).toLocaleString("en-GB")}
              </p>
            </>
          )}
        </section>

        {/* Section 3 — Actions */}
        {canAct && (
          <section className="admin-card">
            <h2 style={{ fontFamily: "var(--font-serif)", marginTop: 0 }}>
              Actions
            </h2>
            <AdminBookingActions
              bookingId={booking.id}
              status={booking.status as "pending" | "confirmed"}
            />
          </section>
        )}
      </main>
    </>
  );
}
