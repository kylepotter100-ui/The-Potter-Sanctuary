import Link from "next/link";
import AdminHeader from "@/components/AdminHeader";
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

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

type Params = Promise<{ id: string }>;

export default async function AdminConsultationPage({
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
          <h1>Consultation</h1>
          <p className="lede">Supabase isn't configured yet.</p>
        </main>
      </>
    );
  }

  const { data: booking } = await supabaseAdmin
    .from("bookings")
    .select(
      "id, customer_first_name, customer_last_name, customer_email, treatment_name, booking_date, booking_time, customer_id"
    )
    .eq("id", id)
    .maybeSingle();

  if (!booking) {
    return (
      <>
        <AdminHeader active="bookings" />
        <main className="admin-main">
          <h1>Consultation</h1>
          <p className="lede">Booking not found.</p>
          <p>
            <Link href="/admin/bookings" className="account-link">
              ← Back to bookings
            </Link>
          </p>
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

  if (!consult) {
    return (
      <>
        <AdminHeader active="bookings" />
        <main className="admin-main">
          <h1>Consultation</h1>
          <p className="lede">No consultation submitted for this booking yet.</p>
          <p>
            <Link href="/admin/bookings" className="account-link">
              ← Back to bookings
            </Link>
          </p>
        </main>
      </>
    );
  }

  const conditions = (consult.conditions as Record<string, boolean>) ?? {};
  const checked = HEALTH_CONDITIONS.filter((c) => conditions[c.key]);
  const focusAreas = (consult.focus_areas as string[]) ?? [];

  return (
    <>
      <AdminHeader active="bookings" />
      <main className="admin-main">
        <p style={{ marginBottom: 8 }}>
          <Link href="/admin/bookings" className="account-link">
            ← Back to bookings
          </Link>
        </p>
        <h1>Consultation</h1>
        <p className="lede">
          {booking.customer_first_name} {booking.customer_last_name} ·{" "}
          {booking.treatment_name} · {fmtDate(booking.booking_date)} at{" "}
          {booking.booking_time.slice(0, 5)}
        </p>

        <section className="admin-card" style={{ marginBottom: 16 }}>
          <h2 style={{ fontFamily: "var(--font-serif)", marginTop: 0 }}>
            Health History
          </h2>
          <p>
            <strong>Conditions:</strong>{" "}
            {checked.length === 0
              ? "None reported"
              : checked.map((c) => c.label).join(", ")}
          </p>
          {conditions.allergies && (
            <p>
              <strong>Allergies (specified):</strong>{" "}
              {fmtText(consult.allergies_specify)}
            </p>
          )}
          <p>
            <strong>Other medical conditions:</strong>{" "}
            {fmtText(consult.other_medical_conditions)}
          </p>
          <p>
            <strong>Currently under medical care:</strong>{" "}
            {fmtBool(consult.under_medical_care)}
          </p>
          {consult.under_medical_care && (
            <p>
              <strong>Explanation:</strong>{" "}
              {fmtText(consult.medical_care_explanation)}
            </p>
          )}
        </section>

        <section className="admin-card" style={{ marginBottom: 16 }}>
          <h2 style={{ fontFamily: "var(--font-serif)", marginTop: 0 }}>
            Massage Preferences
          </h2>
          <p>
            <strong>Focus areas:</strong>{" "}
            {focusAreas.length === 0 ? "—" : focusAreas.join(", ")}
          </p>
          <p>
            <strong>Areas to avoid:</strong> {fmtText(consult.areas_to_avoid)}
          </p>
          <p>
            <strong>Pressure preference:</strong>{" "}
            {fmtText(consult.pressure_preference)}
          </p>
          <p>
            <strong>Had professional massage before:</strong>{" "}
            {fmtBool(consult.had_professional_massage_before)}
          </p>
        </section>

        <section className="admin-card" style={{ marginBottom: 16 }}>
          <h2 style={{ fontFamily: "var(--font-serif)", marginTop: 0 }}>
            Lifestyle &amp; Wellness
          </h2>
          <p>
            <strong>Experiences stress regularly:</strong>{" "}
            {fmtBool(consult.experiences_stress_regularly)}
          </p>
          <p>
            <strong>Primary reason for visit:</strong>{" "}
            {fmtText(consult.primary_reason)}
          </p>
          <p>
            <strong>Additional info:</strong> {fmtText(consult.additional_info)}
          </p>
        </section>

        <section className="admin-card">
          <h2 style={{ fontFamily: "var(--font-serif)", marginTop: 0 }}>
            Consent
          </h2>
          <p>
            <strong>Consent given:</strong> {fmtBool(consult.consent_given)}
          </p>
          <p>
            <strong>Signed by:</strong> {fmtText(consult.signature_name)}
          </p>
          <p>
            <strong>Signed on:</strong> {fmtDate(consult.consent_date)}
          </p>
          <p style={{ opacity: 0.6, fontSize: 12 }}>
            Submitted {new Date(consult.created_at as string).toLocaleString("en-GB")}
          </p>
        </section>
      </main>
    </>
  );
}
