import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type ConsultationPayload = {
  conditions: Record<string, boolean>;
  allergies_specify: string | null;
  other_medical_conditions: string | null;
  under_medical_care: boolean | null;
  medical_care_explanation: string | null;
  focus_areas: string[];
  areas_to_avoid: string | null;
  pressure_preference: "Light" | "Medium" | "Firm" | null;
  experiences_stress_regularly: boolean | null;
  primary_reason: string | null;
  additional_info: string | null;
};

type Payload = {
  full_name: string | null;
  date_of_birth: string | null;
  phone_number: string | null;
  address: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  consultation?: ConsultationPayload | null;
};

export async function POST(req: Request) {
  let payload: Payload;
  try {
    payload = (await req.json()) as Payload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  const emailLower = user.email.toLowerCase();
  const { data: customer } = await supabaseAdmin
    .from("customers")
    .select("id")
    .eq("email", emailLower)
    .maybeSingle();
  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  const { error } = await supabaseAdmin
    .from("customers")
    .update({
      full_name: payload.full_name,
      date_of_birth: payload.date_of_birth,
      phone_number: payload.phone_number,
      address: payload.address,
      emergency_contact_name: payload.emergency_contact_name,
      emergency_contact_phone: payload.emergency_contact_phone,
      updated_at: new Date().toISOString(),
    })
    .eq("id", customer.id);

  if (error) {
    console.error("[customer/profile] update failed", error);
    return NextResponse.json({ error: "Save failed" }, { status: 500 });
  }

  // Consultation/health: maintain the customer's ON-FILE consultation (the
  // most-recent row, which is what booking creation copies forward). Update the
  // health/preference fields only — consent/signature stay per-visit and aren't
  // touched here. Insert a fresh booking_id-NULL row if they have none yet.
  if (payload.consultation) {
    const c = payload.consultation;
    const fields = {
      conditions: c.conditions ?? {},
      allergies_specify: c.allergies_specify,
      other_medical_conditions: c.other_medical_conditions,
      under_medical_care: c.under_medical_care,
      medical_care_explanation: c.medical_care_explanation,
      focus_areas: c.focus_areas ?? [],
      areas_to_avoid: c.areas_to_avoid,
      pressure_preference: c.pressure_preference,
      experiences_stress_regularly: c.experiences_stress_regularly,
      primary_reason: c.primary_reason,
      additional_info: c.additional_info,
    };
    const { data: latest } = await supabaseAdmin
      .from("consultation_responses")
      .select("id")
      .eq("customer_id", customer.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latest) {
      const { error: cErr } = await supabaseAdmin
        .from("consultation_responses")
        .update(fields)
        .eq("id", latest.id);
      if (cErr) console.error("[customer/profile] consult update failed", cErr);
    } else {
      const { error: cErr } = await supabaseAdmin
        .from("consultation_responses")
        .insert({ customer_id: customer.id, booking_id: null, ...fields });
      if (cErr) console.error("[customer/profile] consult insert failed", cErr);
    }
  }

  return NextResponse.json({ ok: true });
}
