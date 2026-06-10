import { NextResponse } from "next/server";
import { Resend } from "resend";
import { render } from "@react-email/render";
import BookingConfirmation from "@/emails/BookingConfirmation";
import OwnerNotification from "@/emails/OwnerNotification";
import { supabaseAdmin } from "@/lib/supabase";
import { siteConfig } from "@/lib/site";
import { validateSlotAvailable } from "@/lib/availability";
import { services } from "@/lib/services";
import { formatLongDate, formatTime12h, formatTimestamp } from "@/lib/format";

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

  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Booking storage is not configured on the server" },
      { status: 500 }
    );
  }

  const slotTime = payload.time.length === 5 ? `${payload.time}:00` : payload.time;
  const emailLower = payload.email.toLowerCase();
  const fullName = `${payload.fname} ${payload.lname}`.trim();

  // The services list is the source of truth for treatment id, display name,
  // price AND duration — never the client payload. The UI only submits ids
  // from this list, so rejecting unknown ids changes nothing for legitimate
  // customers; it stops a tampered payload recording an arbitrary name/price.
  const service = services.find((s) => s.bookingId === payload.service.svc);
  if (!service) {
    return NextResponse.json({ error: "Unknown treatment" }, { status: 400 });
  }
  const treatmentName = `${service.name} ${service.nameEm}`.trim();
  const treatmentPrice = Math.round(service.price);
  const durationMinutes = service.durationMinutes;

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
  // Atomic upsert on the unique email: two concurrent first-time bookings from
  // the same address both resolve to the SAME row (the racy select→insert used
  // here previously left the loser's booking with customer_id = NULL when its
  // insert hit the unique constraint). Existing customers get their basic
  // fields refreshed, same as before.
  let customerId: string | null = null;
  const { data: upsertedCustomer, error: customerError } = await supabaseAdmin
    .from("customers")
    .upsert(
      {
        email: emailLower,
        full_name: fullName,
        first_name: payload.fname,
        last_name: payload.lname,
        phone_number: payload.phone,
        gender: payload.gender ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "email" }
    )
    .select("id")
    .single();
  if (customerError) {
    // Booking still proceeds (unlinked) — the linkage is repairable later.
    console.error("[booking] customer upsert failed", customerError);
  } else {
    customerId = upsertedCustomer.id;
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
      treatment_id: service.bookingId,
      treatment_name: treatmentName,
      treatment_price: treatmentPrice,
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
  const siteUrl = siteConfig.url;

  try {
    const [customerHtml, ownerHtml] = await Promise.all([
      render(
        BookingConfirmation({
          firstName: payload.fname,
          treatmentName: treatmentName,
          bookingDate: dateLong,
          bookingTime: timeNice,
          treatmentPrice: treatmentPrice,
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
          treatmentName: treatmentName,
          bookingDate: dateLong,
          bookingTime: timeNice,
          treatmentPrice: treatmentPrice,
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
        subject: `New booking — ${treatmentName} — ${payload.fname} ${payload.lname}`,
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
