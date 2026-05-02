import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";
import SageBrandedHeader from "@/components/SageBrandedHeader";
import QuestionnaireForm, {
  type CustomerSeed,
  type ConsultationSeed,
} from "@/components/QuestionnaireForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Consultation — The Potter Sanctuary",
  description: "Complete your consultation form before your session.",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<{ booking?: string }>;

export default async function QuestionnairePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const bookingId = params.booking ?? null;

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user || !user.email) {
    const next = bookingId
      ? `/questionnaire?booking=${encodeURIComponent(bookingId)}`
      : "/questionnaire";
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  if (!supabaseAdmin) {
    return (
      <>
        <SageBrandedHeader />
        <main className="questionnaire-page">
          <div className="questionnaire-shell">
            <h1>Consultation</h1>
            <p className="lede">Supabase isn&apos;t configured yet.</p>
          </div>
        </main>
      </>
    );
  }

  const emailLower = user.email.toLowerCase();

  // If the URL carries a booking id, check it belongs to the signed-in user.
  // This stops someone with a magic link from viewing/editing another
  // customer's booking by guessing the id.
  if (bookingId) {
    const { data: booking } = await supabaseAdmin
      .from("bookings")
      .select("id, customer_email")
      .eq("id", bookingId)
      .maybeSingle();

    if (booking && booking.customer_email?.toLowerCase() !== emailLower) {
      return (
        <>
          <SageBrandedHeader />
          <main className="questionnaire-page">
            <div className="questionnaire-shell">
              <h1>Wrong account</h1>
              <p className="lede">
                This booking is registered to a different email address. Please
                sign in with the email address used for the booking.
              </p>
              <form
                method="post"
                action="/api/auth/signout"
                style={{ marginTop: 24 }}
              >
                <button type="submit" className="login-btn">
                  Sign out and try again
                </button>
              </form>
            </div>
          </main>
        </>
      );
    }
  }

  const { data: customer } = await supabaseAdmin
    .from("customers")
    .select(
      "id, email, full_name, date_of_birth, phone_number, address, emergency_contact_name, emergency_contact_phone"
    )
    .eq("email", emailLower)
    .maybeSingle();

  if (!customer) {
    // Should not normally happen — the auth callback creates one. Bail safely.
    return (
      <>
        <SageBrandedHeader />
        <main className="questionnaire-page">
          <div className="questionnaire-shell">
            <h1>Consultation</h1>
            <p className="lede">
              We couldn&apos;t find your client record. Please make a booking
              first or contact hello@thepottersanctuary.co.uk.
            </p>
          </div>
        </main>
      </>
    );
  }

  const { data: previous } = await supabaseAdmin
    .from("consultation_responses")
    .select(
      "conditions, allergies_specify, other_medical_conditions, under_medical_care, medical_care_explanation, focus_areas, areas_to_avoid, pressure_preference, had_professional_massage_before, experiences_stress_regularly, primary_reason, additional_info"
    )
    .eq("customer_id", customer.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const customerSeed: CustomerSeed = {
    full_name: customer.full_name,
    date_of_birth: customer.date_of_birth,
    phone_number: customer.phone_number,
    email: customer.email,
    address: customer.address,
    emergency_contact_name: customer.emergency_contact_name,
    emergency_contact_phone: customer.emergency_contact_phone,
  };

  const previousSeed: ConsultationSeed | null = previous
    ? {
        conditions: (previous.conditions as Record<string, boolean>) ?? {},
        allergies_specify: previous.allergies_specify,
        other_medical_conditions: previous.other_medical_conditions,
        under_medical_care: previous.under_medical_care,
        medical_care_explanation: previous.medical_care_explanation,
        focus_areas: previous.focus_areas ?? [],
        areas_to_avoid: previous.areas_to_avoid,
        pressure_preference: previous.pressure_preference,
        had_professional_massage_before: previous.had_professional_massage_before,
        experiences_stress_regularly: previous.experiences_stress_regularly,
        primary_reason: previous.primary_reason,
        additional_info: previous.additional_info,
      }
    : null;

  return (
    <>
      <SageBrandedHeader />
      <main className="questionnaire-page">
        <div className="questionnaire-shell">
          <h1>Your consultation</h1>
          <p className="lede">
            A few questions to help us tailor your treatment. Your answers are
            private and will only be seen by your therapist.
          </p>
          <QuestionnaireForm
            bookingId={bookingId}
            customer={customerSeed}
            previous={previousSeed}
          />
        </div>
      </main>
    </>
  );
}
