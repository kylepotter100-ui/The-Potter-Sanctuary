import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";
import ProfileForm, {
  type ProfileSeed,
  type ConsultSeed,
} from "@/components/ProfileForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your profile — The Potter Sanctuary",
  robots: { index: false, follow: false },
};

export default async function ProfilePage() {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user || !user.email) {
    redirect("/login?next=/account/profile");
  }

  if (!supabaseAdmin) {
    return (
      <main className="account-page">
        <div className="account-shell">
          <h1>Your profile</h1>
          <p className="account-empty">Supabase isn't configured yet.</p>
        </div>
      </main>
    );
  }

  const emailLower = user.email.toLowerCase();
  const { data: customer } = await supabaseAdmin
    .from("customers")
    .select(
      "id, full_name, date_of_birth, phone_number, address, emergency_contact_name, emergency_contact_phone"
    )
    .eq("email", emailLower)
    .maybeSingle();

  const seed: ProfileSeed = {
    full_name: customer?.full_name ?? null,
    date_of_birth: customer?.date_of_birth ?? null,
    phone_number: customer?.phone_number ?? null,
    address: customer?.address ?? null,
    emergency_contact_name: customer?.emergency_contact_name ?? null,
    emergency_contact_phone: customer?.emergency_contact_phone ?? null,
  };

  // The customer's most-recent consultation on file (what carries to bookings).
  let consult: ConsultSeed = null;
  if (customer) {
    const { data: c } = await supabaseAdmin
      .from("consultation_responses")
      .select(
        "conditions, allergies_specify, other_medical_conditions, under_medical_care, medical_care_explanation, focus_areas, areas_to_avoid, pressure_preference, experiences_stress_regularly, primary_reason, additional_info"
      )
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (c) {
      consult = {
        conditions: (c.conditions as Record<string, boolean>) ?? {},
        allergies_specify: c.allergies_specify ?? null,
        other_medical_conditions: c.other_medical_conditions ?? null,
        under_medical_care: c.under_medical_care ?? null,
        medical_care_explanation: c.medical_care_explanation ?? null,
        focus_areas: (c.focus_areas as string[]) ?? [],
        areas_to_avoid: c.areas_to_avoid ?? null,
        pressure_preference:
          (c.pressure_preference as "Light" | "Medium" | "Firm" | null) ?? null,
        experiences_stress_regularly: c.experiences_stress_regularly ?? null,
        primary_reason: c.primary_reason ?? null,
        additional_info: c.additional_info ?? null,
      };
    }
  }

  return (
    <main className="account-page">
      <div className="account-shell">
        <header className="account-header">
          <div>
            <h1>Your profile</h1>
            <div className="email">{user.email}</div>
          </div>
          <div className="account-actions">
            <Link href="/account" className="account-link">
              ← Back to account
            </Link>
          </div>
        </header>
        <ProfileForm seed={seed} consult={consult} email={user.email} />
      </div>
    </main>
  );
}
