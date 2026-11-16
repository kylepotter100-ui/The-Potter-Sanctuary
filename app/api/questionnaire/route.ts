import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";
import {
  sanitizeConsent,
  sanitizeConsultation,
  sanitizeCustomerProfile,
} from "@/lib/consultation-validate";

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

  const consent = sanitizeConsent(payload?.response);
  if (!consent.ok) {
    return NextResponse.json({ error: consent.error }, { status: 400 });
  }
  const consult = sanitizeConsultation(payload?.response, {
    includeHadMassageBefore: true,
  });
  if (!consult.ok) {
    return NextResponse.json({ error: consult.error }, { status: 400 });
  }
  const profile = sanitizeCustomerProfile(payload?.customer);
  if (!profile.ok) {
    return NextResponse.json({ error: profile.error }, { status: 400 });
  }
  if (
    payload.booking_id != null &&
    (typeof payload.booking_id !== "string" ||
      !/^[0-9a-f-]{36}$/i.test(payload.booking_id))
  ) {
    return NextResponse.json({ error: "Invalid booking" }, { status: 400 });
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
    .update({ ...profile.value, updated_at: new Date().toISOString() })
    .eq("id", customer.id);

  // Verify the booking belongs to this customer if one was supplied.
  let bookingId: string | null = null;
  if (payload.booking_id) {
    const { data: booking } = await supabaseAdmin
      .from("bookings")
      .select("id, customer_id, customer_email")
      .eq("id", payload.booking_id)
      .maybeSingle();
    if (booking && booking.customer_id === customer.id) {
      bookingId = booking.id;
    } else if (
      booking &&
      !booking.customer_id &&
      (booking.customer_email ?? "").toLowerCase() === emailLower
    ) {
      // Unlinked booking made with THIS person's email: claim it. Without the
      // email match any signed-in customer could attach any unlinked booking
      // (and its consultation) to themselves by guessing its id.
      // Backfill the link if the booking pre-dates the customer linkage.
      await supabaseAdmin
        .from("bookings")
        .update({ customer_id: customer.id })
        .eq("id", booking.id);
      bookingId = booking.id;
    }
  }

  const { error: insertErr } = await supabaseAdmin
    .from("consultation_responses")
    .upsert({
      customer_id: customer.id,
      booking_id: bookingId,
      ...consult.value,
      ...consent.value,
    },
    { onConflict: "booking_id" });

  if (insertErr) {
    console.error("[questionnaire] insert failed", insertErr.code, insertErr.message);
    return NextResponse.json(
      { error: "Could not save your consultation" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
