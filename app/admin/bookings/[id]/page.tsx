import Link from "next/link";
import AdminHeader from "@/components/AdminHeader";
import AdminBookingActions from "@/components/AdminBookingActions";
import NudgeQuestionnaireButton from "@/components/NudgeQuestionnaireButton";
import RequestReviewButton from "@/components/RequestReviewButton";
import { supabaseAdmin } from "@/lib/supabase";
import { customerHasReviewed } from "@/lib/reviews";
import { getLatestConsultationForCustomer } from "@/lib/consultation";
import { resolveBack } from "@/lib/admin-back";

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

const FOCUS_AREAS: string[] = [
  "Back",
  "Neck",
  "Shoulders",
  "Legs",
  "Arms",
  "Feet",
  "Full Body",
];

function CheckList({
  items,
  ticked,
}: {
  items: Array<{ key: string; label: string }>;
  ticked: Record<string, boolean>;
}) {
  return (
    <ul className="q-checklist">
      {items.map((it) => (
        <li key={it.key} className={ticked[it.key] ? "is-ticked" : ""}>
          <span aria-hidden="true">{ticked[it.key] ? "☑" : "☐"}</span>
          {it.label}
        </li>
      ))}
    </ul>
  );
}

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
type SearchParams = Promise<{ from?: string }>;

export default async function AdminBookingDetailPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const { from } = await searchParams;
  const back = resolveBack(from);

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

  // Use select("*") so the page still renders if the Phase 2 cancellation
  // columns haven't been added yet — the table can have any superset of the
  // columns we read below. supabaseAdmin is the service-role client, so this
  // bypasses RLS by design (admin pages are gated by middleware).
  const { data: booking, error: bookingError } = await supabaseAdmin
    .from("bookings")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (bookingError) {
    console.error(
      "[admin booking detail] booking query failed",
      JSON.stringify(bookingError)
    );
  }

  if (!booking) {
    return (
      <>
        <AdminHeader active="bookings" />
        <main className="admin-main">
          <p style={{ marginBottom: 8 }}>
            <Link href={back.href} className="admin-back-link">
              ← Back to {back.label}
            </Link>
          </p>
          <h1>Booking not found</h1>
          {bookingError && (
            <p className="error-text">
              Database error: {bookingError.message}
            </p>
          )}
        </main>
      </>
    );
  }

  const { data: consult, error: consultError } = await supabaseAdmin
    .from("consultation_responses")
    .select("*")
    .eq("booking_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (consultError) {
    console.error(
      "[admin booking detail] consult query failed",
      JSON.stringify(consultError)
    );
  }

  // If this booking has no consultation of its own, fall back to the customer's
  // most recent one (carried over from an earlier visit) so a returning client
  // who rebooked without signing in doesn't read as a blank "not completed".
  // The owner re-confirms each visit, so it's rendered as "on file (carried
  // over)" — distinct from one freshly completed for this booking.
  let carried: Record<string, unknown> | null = null;
  if (!consult && booking.customer_id) {
    carried = await getLatestConsultationForCustomer(
      supabaseAdmin,
      booking.customer_id as string
    );
  }
  const displayConsult = (consult ?? carried) as Record<string, unknown> | null;
  const isCarried = !consult && !!carried;

  const conditions = displayConsult
    ? ((displayConsult.conditions as Record<string, boolean>) ?? {})
    : {};
  const focusAreas = displayConsult
    ? ((displayConsult.focus_areas as string[]) ?? [])
    : [];
  const focusTicked: Record<string, boolean> = {};
  for (const f of focusAreas) focusTicked[f] = true;

  const canAct = booking.status === "pending" || booking.status === "confirmed";

  // Review state (customer-level), read from existing tables (no schema change):
  //   "left"      → this customer has reviewed on ANY of their bookings
  //   "requested" → review_email_sent_at set but no review submitted yet
  //   "none"      → neither — the review can still be requested
  const reviewLeft = await customerHasReviewed(supabaseAdmin, {
    customerId: (booking.customer_id as string | null) ?? null,
    email: booking.customer_email as string,
  });
  const reviewState: "left" | "requested" | "none" = reviewLeft
    ? "left"
    : booking.review_email_sent_at
      ? "requested"
      : "none";

  return (
    <>
      <AdminHeader active="bookings" />
      <main className="admin-main">
        <p style={{ marginBottom: 8 }}>
          <Link href={back.href} className="admin-back-link">
            ← Back to {back.label}
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
            Consultation Response{consult ? " ✓" : isCarried ? " — on file" : ""}
          </h2>
          {!displayConsult ? (
            <>
              <p className="lede" style={{ margin: 0 }}>
                No consultation submitted yet.
              </p>
              {booking.status !== "cancelled" && (
                <NudgeQuestionnaireButton bookingId={booking.id} />
              )}
            </>
          ) : (
            <div className="q-readonly">
              {isCarried && (
                <div className="info-text" style={{ marginBottom: 16 }}>
                  On file from a previous visit
                  {displayConsult.consent_date
                    ? ` (${fmtShortDate(displayConsult.consent_date as string | null)})`
                    : ""}
                  . This client rebooked without signing in, so it hasn&apos;t
                  been re-confirmed for this booking — confirm details with the
                  client, or nudge them to update it.
                  {booking.status !== "cancelled" && (
                    <div style={{ marginTop: 10 }}>
                      <NudgeQuestionnaireButton bookingId={booking.id} />
                    </div>
                  )}
                </div>
              )}
              {/* SECTION 1 — Client Information */}
              <h3 className="q-readonly-section">Section 1 — Client Information</h3>
              <dl className="q-readonly-list">
                <dt>Name</dt>
                <dd>
                  {booking.customer_first_name} {booking.customer_last_name}
                </dd>
                <dt>Email</dt>
                <dd>{booking.customer_email}</dd>
                <dt>Phone</dt>
                <dd>{booking.customer_phone}</dd>
              </dl>

              {/* SECTION 2 — Health History */}
              <h3 className="q-readonly-section">Section 2 — Health History</h3>
              <p className="q-readonly-label">Conditions</p>
              <CheckList items={HEALTH_CONDITIONS} ticked={conditions} />
              {conditions.allergies ? (
                <dl className="q-readonly-list">
                  <dt>Allergies — please specify</dt>
                  <dd>{fmtText(displayConsult.allergies_specify as string | null)}</dd>
                </dl>
              ) : null}
              <dl className="q-readonly-list">
                <dt>Other medical conditions</dt>
                <dd className="q-readonly-multiline">
                  {fmtText(displayConsult.other_medical_conditions as string | null)}
                </dd>
                <dt>Currently under medical care?</dt>
                <dd>{fmtBool(displayConsult.under_medical_care as boolean | null)}</dd>
                {displayConsult.under_medical_care ? (
                  <>
                    <dt>Explanation</dt>
                    <dd className="q-readonly-multiline">
                      {fmtText(displayConsult.medical_care_explanation as string | null)}
                    </dd>
                  </>
                ) : null}
              </dl>

              {/* SECTION 3 — Massage Preferences */}
              <h3 className="q-readonly-section">
                Section 3 — Massage Preferences
              </h3>
              <p className="q-readonly-label">Focus areas</p>
              <CheckList
                items={FOCUS_AREAS.map((f) => ({ key: f, label: f }))}
                ticked={focusTicked}
              />
              <dl className="q-readonly-list">
                <dt>Areas to avoid</dt>
                <dd className="q-readonly-multiline">
                  {fmtText(displayConsult.areas_to_avoid as string | null)}
                </dd>
                <dt>Pressure preference</dt>
                <dd>
                  <span className="q-readonly-pill">
                    {fmtText(displayConsult.pressure_preference as string | null)}
                  </span>
                </dd>
                <dt>Had professional massage before?</dt>
                <dd>
                  {fmtBool(
                    displayConsult.had_professional_massage_before as boolean | null
                  )}
                </dd>
              </dl>

              {/* SECTION 4 — Lifestyle & Wellness */}
              <h3 className="q-readonly-section">
                Section 4 — Lifestyle &amp; Wellness
              </h3>
              <dl className="q-readonly-list">
                <dt>Experiences stress regularly?</dt>
                <dd>
                  {fmtBool(displayConsult.experiences_stress_regularly as boolean | null)}
                </dd>
                <dt>Primary reason for visit</dt>
                <dd className="q-readonly-multiline">
                  {fmtText(displayConsult.primary_reason as string | null)}
                </dd>
                <dt>Additional information</dt>
                <dd className="q-readonly-multiline">
                  {fmtText(displayConsult.additional_info as string | null)}
                </dd>
              </dl>

              {/* SECTION 5 — Consent & Signature */}
              <h3 className="q-readonly-section">
                Section 5 — Consent &amp; Signature
              </h3>
              <dl className="q-readonly-list">
                <dt>Consent given</dt>
                <dd>{fmtBool(displayConsult.consent_given as boolean | null)}</dd>
                <dt>Signed by</dt>
                <dd>{fmtText(displayConsult.signature_name as string | null)}</dd>
                <dt>Signed on</dt>
                <dd>{fmtShortDate(displayConsult.consent_date as string | null)}</dd>
              </dl>
              <p className="q-readonly-meta">
                {isCarried ? "Carried over — originally submitted " : "Submitted "}
                {new Date(displayConsult.created_at as string).toLocaleString("en-GB")}
              </p>
            </div>
          )}
        </section>

        {/* Section 3 — Customer review */}
        <section className="admin-card" style={{ marginBottom: 16 }}>
          <h2 style={{ fontFamily: "var(--font-serif)", marginTop: 0 }}>
            Customer Review{reviewState === "left" ? " ✓" : ""}
          </h2>
          <p className="lede" style={{ margin: 0 }}>
            {reviewState === "left"
              ? "This customer has left you a review."
              : "This customer hasn't left a review yet."}
          </p>
          <RequestReviewButton
            bookingId={booking.id}
            reviewState={reviewState}
            canRequest={booking.status !== "cancelled"}
            lastRequestedAt={(booking.review_email_sent_at as string | null) ?? null}
          />
        </section>

        {/* Section 4 — Actions */}
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
