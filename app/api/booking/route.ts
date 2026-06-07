import { NextResponse } from "next/server";
import { Resend } from "resend";
import { render } from "@react-email/render";
import BookingConfirmation from "@/emails/BookingConfirmation";
import OwnerNotification from "@/emails/OwnerNotification";
import { supabaseAdmin } from "@/lib/supabase";
import { validateSlotAvailable } from "@/lib/availability";
import { durationMinutesForTreatmentId } from "@/lib/services";
import { formatLongDate, formatTime12h, formatTimestamp } from "@/lib/format";
import { firstTooLong, safeSubject } from "@/lib/validation";

type Payload = {
  date: string;
  dateLabel: string;
  time: string;
  service: { svc: string; name: string; price: number; duration: string };
  gender: string | null;
  fname: string;
  lname: string;
  phone: string;
  email: string;
  message?: string;
  // Returning customers tell us whether their consultation details are still
  // current. true = no change (skip questionnaire CTA), false = needs new
  // questionnaire, null/undefined = first-time booking (always send CTA).
  detailsUnchanged?: boolean | null;
};

const FROM = "The Potter Sanctuary <hello@thepottersanctuary.co.uk>";
const OWNER_TO = "hello@thepottersanctuary.co.uk";

export async function POST(req: Request) {
  let payload: Payload;
  try {
    payload = (await req.json()) as Payload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const required = [
    payload?.date,
    payload?.time,
    payload?.service?.name,
    payload?.service?.svc,
    payload?.fname,
    payload?.lname,
    payload?.phone,
    payload?.email,
  ];
  if (
    required.some((v) => !v) ||
    !/\S+@\S+\.\S+/.test(payload.email) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(payload.date) ||
    !/^\d{2}:\d{2}(:\d{2})?$/.test(payload.time)
  ) {
    return NextResponse.json(
      { error: "Missing or invalid required fields" },
      { status: 400 }
    );
  }

  // Server-side length caps (DoS / DB bloat / UI + email overflow).
  const tooLong = firstTooLong({
    fname: [payload.fname, 100],
    lname: [payload.lname, 100],
    phone: [payload.phone, 30],
    email: [payload.email, 254],
    message: [payload.message, 5000],
    "service.name": [payload.service?.name, 200],
  });
  if (tooLong) {
    return NextResponse.json(
      { error: `Field too long: ${tooLong}` },
      { status: 400 }
    );
  }

  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Booking storage is not configured on the server" },
      { status: 500 }
    );
  }

  const slotTime = payload.time.length === 5 ? `${payload.time}:00` : payload.time;
  const emailLower = payload.email.toLowerCase();
  const fullName = `${payload.fname} ${payload.lname}`.trim();

  // The CORRECTED duration for this treatment (new bookings use the updated
  // lengths). Falls back to 60 if the treatment_id is somehow unknown.
  const durationMinutes =
    durationMinutesForTreatmentId(payload.service.svc) ?? 60;

  // Server-side slot validation — never trust the client's date/time/duration.
  // Runs the same shared interval check the calendar uses (finishes by close;
  // session segments open; interval doesn't intersect any existing booking).
  // The unique-violation / exclusion-constraint handlers below remain as the
  // hard concurrency guards.
  const slotCheck = await validateSlotAvailable(
    supabaseAdmin,
    payload.date,
    payload.time,
    durationMinutes
  );
  if (!slotCheck.ok) {
    return NextResponse.json(
      { error: "slot_unavailable", message: slotCheck.reason },
      { status: 409 }
    );
  }

  // Look up or create the customer record so every booking is linked to one.
  let customerId: string | null = null;
  const { data: existingCustomer } = await supabaseAdmin
    .from("customers")
    .select("id")
    .eq("email", emailLower)
    .maybeSingle();

  if (existingCustomer) {
    customerId = existingCustomer.id;
    // Refresh the basic fields the customer just gave us.
    await supabaseAdmin
      .from("customers")
      .update({
        full_name: fullName,
        first_name: payload.fname,
        last_name: payload.lname,
        phone_number: payload.phone,
        gender: payload.gender ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", customerId);
  } else {
    const { data: newCustomer, error: customerError } = await supabaseAdmin
      .from("customers")
      .insert({
        email: emailLower,
        full_name: fullName,
        first_name: payload.fname,
        last_name: payload.lname,
        phone_number: payload.phone,
        gender: payload.gender ?? null,
      })
      .select("id")
      .single();
    if (customerError) {
      console.error("[booking] customer insert failed", customerError);
    } else {
      customerId = newCustomer.id;
    }
  }

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("bookings")
    .insert({
      customer_id: customerId,
      customer_first_name: payload.fname,
      customer_last_name: payload.lname,
      customer_email: payload.email,
      customer_phone: payload.phone,
      customer_gender: payload.gender ?? null,
      treatment_id: payload.service.svc,
      treatment_name: payload.service.name,
      treatment_price: Math.round(payload.service.price),
      booking_date: payload.date,
      booking_time: slotTime,
      duration_minutes: durationMinutes,
      message: payload.message?.trim() || null,
      status: "pending",
    })
    .select("id")
    .single();

  if (insertError) {
    console.error(
      "[booking] supabase insert failed",
      JSON.stringify(insertError)
    );
    // Postgres 23505 = unique_violation (identical-start guard,
    // bookings_active_slot_unique) and 23P01 = exclusion_violation
    // (bookings_no_overlap — the real overlap backstop). Either fires when two
    // customers race for intersecting intervals; surface the same friendly 409.
    if (
      (insertError as { code?: string }).code === "23505" ||
      (insertError as { code?: string }).code === "23P01" ||
      /duplicate key|unique constraint|bookings_active_slot_unique|exclusion constraint|bookings_no_overlap/i.test(
        insertError.message ?? ""
      )
    ) {
      return NextResponse.json(
        {
          error: "slot_taken",
          message:
            "Sorry, that time slot was just taken — please pick another time.",
        },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Could not save your booking. Please try again." },
      { status: 500 }
    );
  }

  // detailsUnchanged === true → returning customer says nothing changed,
  //   copy their most recent consultation_response and link it to this new
  //   booking; email skips the questionnaire CTA.
  // detailsUnchanged === false → returning customer needs to update,
  //   email keeps the CTA so they can fill in a fresh questionnaire.
  // detailsUnchanged === null/undefined → first-time customer, always
  //   include the CTA.
  let includeConsultationCTA = true;
  if (payload.detailsUnchanged === true && customerId) {
    const { data: prior, error: priorErr } = await supabaseAdmin
      .from("consultation_responses")
      .select(
        "conditions, allergies_specify, other_medical_conditions, under_medical_care, medical_care_explanation, focus_areas, areas_to_avoid, pressure_preference, had_professional_massage_before, experiences_stress_regularly, primary_reason, additional_info, consent_given, signature_name, consent_date"
      )
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (priorErr) {
      console.error("[booking] prior consult lookup failed", JSON.stringify(priorErr));
    }

    if (prior) {
      const { error: copyError } = await supabaseAdmin
        .from("consultation_responses")
        .insert({
          customer_id: customerId,
          booking_id: inserted.id,
          ...prior,
        });
      if (copyError) {
        console.error("[booking] consult copy failed", JSON.stringify(copyError));
        // If we couldn't copy the prior consult, fall back to asking again.
        includeConsultationCTA = true;
      } else {
        includeConsultationCTA = false;
      }
    }
  }
  // For detailsUnchanged === false (or null/undefined) we leave
  // includeConsultationCTA = true and don't touch consultation_responses.

  // Email sending is best-effort: if Resend is misconfigured or fails, the
  // booking is already saved and the user gets a success response. We log the
  // failure so the studio can chase up via the admin panel.
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[booking] RESEND_API_KEY missing — booking saved without email");
    return NextResponse.json({ ok: true, id: inserted.id });
  }

  const resend = new Resend(apiKey);

  const dateLong = formatLongDate(payload.date);
  const timeNice = formatTime12h(payload.time);
  const siteUrl = new URL(req.url).origin;

  try {
    const [customerHtml, ownerHtml] = await Promise.all([
      render(
        BookingConfirmation({
          firstName: payload.fname,
          treatmentName: payload.service.name,
          bookingDate: dateLong,
          bookingTime: timeNice,
          treatmentPrice: payload.service.price,
          bookingId: inserted.id,
          siteUrl,
          includeConsultationCTA,
        })
      ),
      render(
        OwnerNotification({
          firstName: payload.fname,
          lastName: payload.lname,
          phone: payload.phone,
          customerEmail: payload.email,
          treatmentName: payload.service.name,
          bookingDate: dateLong,
          bookingTime: timeNice,
          treatmentPrice: payload.service.price,
          gender: payload.gender ?? "—",
          message: payload.message ?? "",
          timestamp: formatTimestamp(),
          siteUrl,
        })
      ),
    ]);

    const results = await Promise.all([
      resend.emails.send({
        from: FROM,
        to: payload.email,
        replyTo: OWNER_TO,
        subject: "Your reservation at The Potter Sanctuary",
        html: customerHtml,
      }),
      resend.emails.send({
        from: FROM,
        to: OWNER_TO,
        replyTo: payload.email,
        subject: safeSubject(
          `New booking — ${payload.service.name} — ${payload.fname} ${payload.lname}`
        ),
        html: ownerHtml,
      }),
    ]);
    for (const r of results) {
      if (r.error) {
        console.error("[booking] Resend error:", JSON.stringify(r.error));
      }
    }
  } catch (err) {
    console.error(
      "[booking] Resend error:",
      JSON.stringify(err, Object.getOwnPropertyNames(err as object))
    );
  }

  return NextResponse.json({ ok: true, id: inserted.id });
}
