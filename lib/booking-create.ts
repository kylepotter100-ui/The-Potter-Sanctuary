import { Resend } from "resend";
import { render } from "@react-email/render";
import BookingConfirmation from "@/emails/BookingConfirmation";
import OwnerNotification from "@/emails/OwnerNotification";
import { supabaseAdmin } from "@/lib/supabase";
import { siteConfig } from "@/lib/site";
import { validateSlotAvailable } from "@/lib/availability";
import { services } from "@/lib/services";
import { normalizePhone } from "@/lib/phone";
import { formatLongDate, formatTime12h, formatTimestamp } from "@/lib/format";

// ============================================================================
// Single home for booking creation — shared by the public booking route
// (app/api/booking/route.ts) and the admin manual-booking route
// (app/api/admin/bookings/create/route.ts). Keeping it here means the
// phone-match customer reconciliation, the 23505/23P01 race handling and the
// confirmation-email logic can never drift between the two entry points.
//
// The ONLY differences between the two callers are passed via options:
//   - status:                "pending" (public) vs "confirmed" (admin manual)
//   - adminMode:             slot rules — false = website availability,
//                            true = "book anytime" (any day/time, clashes only)
//   - sendOwnerNotification: true for public, false for admin (she made it)
// ============================================================================

const FROM = "The Potter Sanctuary <hello@thepottersanctuary.co.uk>";
const OWNER_TO = "hello@thepottersanctuary.co.uk";

export type CreateBookingInput = {
  date: string; // YYYY-MM-DD
  time: string; // HH:MM or HH:MM:SS
  serviceId: string; // services[].bookingId
  gender: string | null;
  fname: string;
  lname: string;
  phone: string;
  email: string;
  message?: string | null;
  // Returning customers tell us whether their consultation details are still
  // current. true = no change, false = needs new questionnaire, null = first-time.
  detailsUnchanged?: boolean | null;
};

export type CreateBookingOptions = {
  status: "pending" | "confirmed";
  adminMode?: boolean;
  sendOwnerNotification?: boolean;
};

export type CreateBookingResult =
  | { ok: true; id: string }
  | { ok: false; status: number; error: string; message?: string };

export async function createBooking(
  input: CreateBookingInput,
  options: CreateBookingOptions
): Promise<CreateBookingResult> {
  if (!supabaseAdmin) {
    return {
      ok: false,
      status: 500,
      error: "Booking storage is not configured on the server",
    };
  }

  const adminMode = options.adminMode === true;
  const slotTime = input.time.length === 5 ? `${input.time}:00` : input.time;
  const emailLower = input.email.toLowerCase();
  const fullName = `${input.fname} ${input.lname}`.trim();

  // The services list is the source of truth for treatment id, display name,
  // price AND duration — never the client payload.
  const service = services.find((s) => s.bookingId === input.serviceId);
  if (!service) {
    return { ok: false, status: 400, error: "Unknown treatment" };
  }
  const treatmentName = `${service.name} ${service.nameEm}`.trim();
  const treatmentPrice = Math.round(service.price);
  const durationMinutes = service.durationMinutes;

  // Server-side slot validation — never trust the client's date/time/duration.
  // adminMode relaxes the open-set/closing/blocked/lead-time rules but keeps the
  // overlap guard (and the DB exclusion constraint below is the hard backstop).
  const slotCheck = await validateSlotAvailable(
    supabaseAdmin,
    input.date,
    input.time,
    durationMinutes,
    { adminMode }
  );
  if (!slotCheck.ok) {
    return {
      ok: false,
      status: 409,
      error: "slot_unavailable",
      message: slotCheck.reason,
    };
  }

  // Look up or create the customer record so every booking is linked to one.
  let customerId: string | null = null;

  // Phone reconciliation — a SECOND exact-match key. It only matters when this
  // email is brand new: a typo'd email won't match an existing row, but the
  // (correct) phone can, so we reuse that customer instead of creating a phantom.
  const phoneNorm = normalizePhone(input.phone);
  const { data: emailMatch } = await supabaseAdmin
    .from("customers")
    .select("id")
    .eq("email", emailLower)
    .maybeSingle();

  if (!emailMatch && phoneNorm) {
    const { data: phoneMatches } = await supabaseAdmin
      .from("customers")
      .select("id")
      .eq("phone_normalized", phoneNorm)
      .limit(2);
    // Exactly one match → confident reuse. Two+ rows share this phone → ambiguous;
    // fall through and create/refresh by email instead.
    if (phoneMatches && phoneMatches.length === 1) {
      customerId = phoneMatches[0].id;
    }
  }

  if (!customerId) {
    // Common path (genuinely new customer, or an existing email): atomic upsert
    // on the unique email so two concurrent first-time bookings resolve to one row.
    const { data: upsertedCustomer, error: customerError } = await supabaseAdmin
      .from("customers")
      .upsert(
        {
          email: emailLower,
          full_name: fullName,
          first_name: input.fname,
          last_name: input.lname,
          phone_number: input.phone,
          gender: input.gender ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "email" }
      )
      .select("id")
      .single();
    if (customerError) {
      console.error("[booking] customer upsert failed", customerError);
    } else {
      customerId = upsertedCustomer.id;
    }
  }

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("bookings")
    .insert({
      customer_id: customerId,
      customer_first_name: input.fname,
      customer_last_name: input.lname,
      customer_email: input.email,
      customer_phone: input.phone,
      customer_gender: input.gender ?? null,
      treatment_id: service.bookingId,
      treatment_name: treatmentName,
      treatment_price: treatmentPrice,
      booking_date: input.date,
      booking_time: slotTime,
      duration_minutes: durationMinutes,
      message: input.message?.trim() || null,
      status: options.status,
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("[booking] supabase insert failed", JSON.stringify(insertError));
    // 23505 = unique_violation (bookings_active_slot_unique), 23P01 =
    // exclusion_violation (bookings_no_overlap) — both fire when two bookings
    // race for intersecting intervals; surface a friendly 409.
    if (
      (insertError as { code?: string }).code === "23505" ||
      (insertError as { code?: string }).code === "23P01" ||
      /duplicate key|unique constraint|bookings_active_slot_unique|exclusion constraint|bookings_no_overlap/i.test(
        insertError.message ?? ""
      )
    ) {
      return {
        ok: false,
        status: 409,
        error: "slot_taken",
        message:
          "Sorry, that time slot was just taken — please pick another time.",
      };
    }
    return {
      ok: false,
      status: 500,
      error: "Could not save your booking. Please try again.",
    };
  }

  // detailsUnchanged === true → returning customer says nothing changed: copy
  // their most recent consultation_response onto this booking; email skips the
  // questionnaire CTA. false/null → keep the CTA.
  let includeConsultationCTA = true;
  if (input.detailsUnchanged === true && customerId) {
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
        .upsert(
          { customer_id: customerId, booking_id: inserted.id, ...prior },
          { onConflict: "booking_id" }
        );
      if (copyError) {
        console.error("[booking] consult copy failed", JSON.stringify(copyError));
        includeConsultationCTA = true;
      } else {
        includeConsultationCTA = false;
      }
    }
  }

  // Email is best-effort: the booking is already saved either way.
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[booking] RESEND_API_KEY missing — booking saved without email");
    return { ok: true, id: inserted.id };
  }

  const resend = new Resend(apiKey);
  const dateLong = formatLongDate(input.date);
  const timeNice = formatTime12h(input.time);
  const siteUrl = siteConfig.url;

  try {
    const customerHtml = await render(
      BookingConfirmation({
        firstName: input.fname,
        treatmentName,
        bookingDate: dateLong,
        bookingTime: timeNice,
        treatmentPrice,
        bookingId: inserted.id,
        siteUrl,
        includeConsultationCTA,
      })
    );

    const sends: Promise<{ error: unknown }>[] = [
      resend.emails.send({
        from: FROM,
        to: input.email,
        replyTo: OWNER_TO,
        subject: "Your reservation at The Potter Sanctuary",
        html: customerHtml,
      }) as Promise<{ error: unknown }>,
    ];

    if (options.sendOwnerNotification) {
      const ownerHtml = await render(
        OwnerNotification({
          firstName: input.fname,
          lastName: input.lname,
          phone: input.phone,
          customerEmail: input.email,
          treatmentName,
          bookingDate: dateLong,
          bookingTime: timeNice,
          treatmentPrice,
          gender: input.gender ?? "—",
          message: input.message ?? "",
          timestamp: formatTimestamp(),
          siteUrl,
        })
      );
      sends.push(
        resend.emails.send({
          from: FROM,
          to: OWNER_TO,
          replyTo: input.email,
          subject: `New booking — ${treatmentName} — ${input.fname} ${input.lname}`,
          html: ownerHtml,
        }) as Promise<{ error: unknown }>
      );
    }

    const results = await Promise.all(sends);
    for (const r of results) {
      if (r.error) console.error("[booking] Resend error:", JSON.stringify(r.error));
    }
  } catch (err) {
    console.error(
      "[booking] Resend error:",
      JSON.stringify(err, Object.getOwnPropertyNames(err as object))
    );
  }

  return { ok: true, id: inserted.id };
}
