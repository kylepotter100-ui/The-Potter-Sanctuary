import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";
import { firstTooLong } from "@/lib/validation";

export const dynamic = "force-dynamic";

type Payload = {
  booking_id: string | null;
  customer: {
    full_name: string | null;
    date_of_birth: string | null;
    phone_number: string | null;
    address: string | null;
    emergency_contact_name: string | null;
    emergency_contact_phone: string | null;
  };
  response: {
    conditions: Record<string, boolean>;
    allergies_specify: string | null;
    other_medical_conditions: string | null;
    under_medical_care: boolean | null;
    medical_care_explanation: string | null;
    focus_areas: string[];
    areas_to_avoid: string | null;
    pressure_preference: "Light" | "Medium" | "Firm" | null;
    had_professional_massage_before: boolean | null;
    experiences_stress_regularly: boolean | null;
    primary_reason: string | null;
    additional_info: string | null;
    consent_given: boolean;
    signature_name: string;
    consent_date: string;
  };
};

export async function POST(req: Request) {
  let payload: Payload;
  try {
    payload = (await req.json()) as Payload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!payload.response?.consent_given) {
    return NextResponse.json({ error: "Consent is required" }, { status: 400 });
  }
  if (!payload.response?.signature_name?.trim()) {
    return NextResponse.json(
      { error: "Signature is required" },
      { status: 400 }
    );
  }

  // Server-side length caps (DoS / DB bloat) on the free-text fields.
  const r0 = payload.response;
  const c0 = payload.customer ?? ({} as Payload["customer"]);
  const tooLong = firstTooLong({
    allergies_specify: [r0.allergies_specify, 500],
    other_medical_conditions: [r0.other_medical_conditions, 1000],
    medical_care_explanation: [r0.medical_care_explanation, 1000],
    areas_to_avoid: [r0.areas_to_avoid, 500],
    primary_reason: [r0.primary_reason, 500],
    additional_info: [r0.additional_info, 1000],
    signature_name: [r0.signature_name, 100],
    full_name: [c0.full_name, 200],
    phone_number: [c0.phone_number, 30],
    address: [c0.address, 500],
    emergency_contact_name: [c0.emergency_contact_name, 200],
    emergency_contact_phone: [c0.emergency_contact_phone, 30],
  });
  if (tooLong) {
    return NextResponse.json(
      { error: `Field too long: ${tooLong}` },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Server not configured" },
      { status: 500 }
    );
  }

  const emailLower = user.email.toLowerCase();
  const { data: customer, error: customerErr } = await supabaseAdmin
    .from("customers")
    .select("id")
    .eq("email", emailLower)
    .maybeSingle();
  if (customerErr || !customer) {
    return NextResponse.json(
      { error: "Customer record not found" },
      { status: 404 }
    );
  }

  // Update profile bits the form may have edited.
  await supabaseAdmin
    .from("customers")
    .update({
      full_name: payload.customer.full_name,
      date_of_birth: payload.customer.date_of_birth,
      phone_number: payload.customer.phone_number,
      address: payload.customer.address,
      emergency_contact_name: payload.customer.emergency_contact_name,
      emergency_contact_phone: payload.customer.emergency_contact_phone,
      updated_at: new Date().toISOString(),
    })
    .eq("id", customer.id);

  // Verify the booking belongs to this customer if one was supplied.
  let bookingId: string | null = null;
  if (payload.booking_id) {
    const { data: booking } = await supabaseAdmin
      .from("bookings")
      .select("id, customer_id")
      .eq("id", payload.booking_id)
      .maybeSingle();
    if (booking && booking.customer_id === customer.id) {
      bookingId = booking.id;
    } else if (booking && !booking.customer_id) {
      // Backfill the link if the booking pre-dates the customer linkage.
      await supabaseAdmin
        .from("bookings")
        .update({ customer_id: customer.id })
        .eq("id", booking.id);
      bookingId = booking.id;
    }
  }

  const r = payload.response;
  const { error: insertErr } = await supabaseAdmin
    .from("consultation_responses")
    .insert({
      customer_id: customer.id,
      booking_id: bookingId,
      conditions: r.conditions ?? {},
      allergies_specify: r.allergies_specify,
      other_medical_conditions: r.other_medical_conditions,
      under_medical_care: r.under_medical_care,
      medical_care_explanation: r.medical_care_explanation,
      focus_areas: r.focus_areas ?? [],
      areas_to_avoid: r.areas_to_avoid,
      pressure_preference: r.pressure_preference,
      had_professional_massage_before: r.had_professional_massage_before,
      experiences_stress_regularly: r.experiences_stress_regularly,
      primary_reason: r.primary_reason,
      additional_info: r.additional_info,
      consent_given: r.consent_given,
      signature_name: r.signature_name.trim(),
      consent_date: r.consent_date,
    });

  if (insertErr) {
    console.error("[questionnaire] insert failed", insertErr);
    return NextResponse.json(
      { error: "Could not save your consultation" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
