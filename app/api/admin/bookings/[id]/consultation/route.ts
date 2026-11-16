import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase";
import {
  sanitizeConsent,
  sanitizeConsultation,
  sanitizeCustomerProfile,
} from "@/lib/consultation-validate";

export const dynamic = "force-dynamic";

// The owner records a consultation WITH a client who can't use the web form
// (by phone or in person). Same validation as the client's own questionnaire,
// plus how consent was obtained, so the record shows it wasn't self-submitted.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }
  const { id } = await params;

  let payload: {
    customer?: unknown;
    response?: unknown;
    consent_method?: unknown;
  };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const method = payload.consent_method;
  if (method !== "verbal" && method !== "paper") {
    return NextResponse.json(
      { error: "Please choose how the client gave consent." },
      { status: 400 }
    );
  }
  const consent = sanitizeConsent(payload.response);
  if (!consent.ok) return NextResponse.json({ error: consent.error }, { status: 400 });
  const consult = sanitizeConsultation(payload.response, { includeHadMassageBefore: true });
  if (!consult.ok) return NextResponse.json({ error: consult.error }, { status: 400 });
  const profile = sanitizeCustomerProfile(payload.customer ?? {});
  if (!profile.ok) return NextResponse.json({ error: profile.error }, { status: 400 });

  const { data: booking } = await supabaseAdmin
    .from("bookings")
    .select("id, customer_id")
    .eq("id", id)
    .maybeSingle();
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (!booking.customer_id) {
    return NextResponse.json(
      { error: "This booking isn't linked to a client record." },
      { status: 409 }
    );
  }

  // Profile fields the owner confirmed with the client (only non-empty ones,
  // so a blank field on the form never wipes what's on file).
  const profilePatch = Object.fromEntries(
    Object.entries(profile.value).filter(([, v]) => v !== null)
  );
  if (Object.keys(profilePatch).length > 0) {
    await supabaseAdmin
      .from("customers")
      .update({ ...profilePatch, updated_at: new Date().toISOString() })
      .eq("id", booking.customer_id);
  }

  const { error } = await supabaseAdmin.from("consultation_responses").upsert(
    {
      customer_id: booking.customer_id,
      booking_id: booking.id,
      ...consult.value,
      ...consent.value,
      consent_method: method,
      recorded_by: "owner",
    },
    { onConflict: "booking_id" }
  );
  if (error) {
    const missing = error.code === "PGRST204" || error.code === "42703";
    console.error("[admin consultation] save failed", error.code, error.message);
    return NextResponse.json(
      {
        error: missing ? "migration_required" : "save_failed",
        message: missing
          ? "Recording consultations needs the latest database update (migration 20261117_offline_consultation_notes)."
          : "Could not save the consultation. Please try again.",
      },
      { status: missing ? 409 : 500 }
    );
  }
  return NextResponse.json({ ok: true });
}
