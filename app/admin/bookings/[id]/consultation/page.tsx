import Link from "next/link";
import AdminHeader from "@/components/AdminHeader";
import QuestionnaireForm, {
  type ConsultationSeed,
  type CustomerSeed,
} from "@/components/QuestionnaireForm";
import { supabaseAdmin } from "@/lib/supabase";
import { requireAdminPage } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

// Owner fills in the consultation WITH a client who can't use the web form.
export default async function OwnerConsultationPage({ params }: { params: Params }) {
  await requireAdminPage();
  const { id } = await params;
  if (!supabaseAdmin) return null;

  const { data: booking } = await supabaseAdmin
    .from("bookings")
    .select("id, customer_id, customer_first_name, customer_last_name, treatment_name, booking_date")
    .eq("id", id)
    .maybeSingle();

  const customer = booking?.customer_id
    ? (
        await supabaseAdmin
          .from("customers")
          .select("*")
          .eq("id", booking.customer_id)
          .maybeSingle()
      ).data
    : null;

  if (!booking || !customer) {
    return (
      <>
        <AdminHeader active="bookings" />
        <main className="admin-main">
          <h1>Consultation</h1>
          <p className="lede">This booking isn&apos;t linked to a client record.</p>
        </main>
      </>
    );
  }

  const { data: previous } = await supabaseAdmin
    .from("consultation_responses")
    .select("*")
    .eq("customer_id", customer.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const customerSeed: CustomerSeed = {
    full_name:
      customer.full_name ??
      `${booking.customer_first_name} ${booking.customer_last_name}`.trim(),
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
      <AdminHeader active="bookings" />
      <main className="admin-main">
        <Link href={`/admin/bookings/${booking.id}`} className="admin-back-link">
          ← Back to booking
        </Link>
        <h1 style={{ marginTop: 10 }}>
          Consultation for {booking.customer_first_name} {booking.customer_last_name}
        </h1>
        <p className="lede">
          Go through these questions with the client by phone or in person.
          {previous ? " Their last answers are filled in — check each one is still right." : ""}
        </p>
        <div className="questionnaire-shell" style={{ maxWidth: "none", padding: 0 }}>
          <QuestionnaireForm
            bookingId={booking.id}
            customer={customerSeed}
            previous={previousSeed}
            ownerMode
          />
        </div>
      </main>
    </>
  );
}
