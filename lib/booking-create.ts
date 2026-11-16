import { Resend } from "resend";
import { sendCustomerEmail } from "@/lib/customer-email";
import { render } from "@react-email/render";
import BookingConfirmation from "@/emails/BookingConfirmation";
import OwnerNotification from "@/emails/OwnerNotification";
import { supabaseAdmin } from "@/lib/supabase";
import { siteConfig } from "@/lib/site";
import { validateSlotAvailable } from "@/lib/availability";
import { services } from "@/lib/services";
import { normalizePhone } from "@/lib/phone";
import { customerHasConsultation } from "@/lib/consultation";
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
  /** Optional only for owner-made bookings for clients who don't use email. */
  email: string | null;
  message?: string | null;
  // Returning customers tell us whether their consultation details are still
  // current. true = no change, false = needs new questionnaire, null = first-time.
  detailsUnchanged?: boolean | null;
  // Set by the public booking route when a valid gift-voucher code was applied
  // and CLAIMED (status flipped active -> redeemed) BEFORE calling this. The
  // caller owns releasing that claim if this function fails — see the route.
  voucher?: { id: string; code: string } | null;
};

export type CreateBookingOptions = {
  status: "pending" | "confirmed";
  adminMode?: boolean;
  sendOwnerNotification?: boolean;
  /**
   * True when the caller has PROVEN who the customer is: the owner (admin
   * manual booking) or a customer signed in with this exact email. Only a
   * trusted caller may overwrite an existing customer's name/phone/gender or
   * copy their previous consultation (including their signed consent) onto a
   * new booking. An anonymous web booking that happens to use an existing
   * email is linked to that customer but changes nothing on their record.
   */
  trustedIdentity?: boolean;
  /**
   * Owner's "don't email this client" switch for this booking. Every client
   * email about the booking then goes nowhere (lib/customer-email.ts).
   */
  suppressComms?: boolean;
  /**
   * Owner-chosen contact preference to store on the client ('phone' = owner
   * phones them, 'none' = no automatic contact). Trusted callers only.
   */
  contactPreference?: "email" | "phone" | "none";
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
  const emailLower = input.email ? input.email.trim().toLowerCase() : null;
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
  const trusted = options.trustedIdentity === true;
  const phoneNorm = normalizePhone(input.phone);
  const { data: emailMatch } = emailLower
    ? await supabaseAdmin
        .from("customers")
        .select("id")
        .eq("email", emailLower)
        .maybeSingle()
    : { data: null };

  if (emailMatch && !trusted) {
    // Existing customer, unproven caller: link only. Never let an anonymous
    // request rewrite someone's record by knowing their email address.
    customerId = emailMatch.id;
  }

  if (!emailMatch && phoneNorm) {
    const { data: phoneMatches } = await supabaseAdmin
      .from("customers")
      .select("id")
      .eq("phone_normalized", phoneNorm)
      .limit(2);
    // Exactly one match → confident reuse (link only, nothing overwritten).
    // Two+ rows share this phone → ambiguous; create by email instead.
    if (phoneMatches && phoneMatches.length === 1) {
      customerId = phoneMatches[0].id;
    }
  }

  // Only written when it differs from the default, so this code keeps working
  // before migration 20261117_contact_preferences adds the column.
  const prefPatch =
    trusted && options.contactPreference && options.contactPreference !== "email"
      ? { contact_preference: options.contactPreference }
      : {};
  const customerFields = {
    full_name: fullName,
    first_name: input.fname,
    last_name: input.lname,
    phone_number: input.phone,
    gender: input.gender ?? null,
    updated_at: new Date().toISOString(),
    ...prefPatch,
  };

  if (!customerId && emailLower) {
    // Genuinely new customer, or a trusted caller refreshing an existing one:
    // atomic upsert on the unique email so two concurrent first-time bookings
    // resolve to one row.
    const { data: upsertedCustomer, error: customerError } = await supabaseAdmin
      .from("customers")
      .upsert({ email: emailLower, ...customerFields }, { onConflict: "email" })
      .select("id")
      .single();
    if (customerError) {
      console.error("[booking] customer upsert failed", customerError.code, customerError.message);
    } else {
      customerId = upsertedCustomer.id;
    }
  } else if (!customerId) {
    // No email (owner booking a phone-only client) and no phone match: new
    // client record keyed on name + phone.
    const { data: created, error: createErr } = await supabaseAdmin
      .from("customers")
      .insert({ email: null, ...customerFields })
      .select("id")
      .single();
    if (createErr) {
      console.error("[booking] customer insert failed", createErr.code, createErr.message);
      return {
        ok: false,
        status: 500,
        error: "customer_create_failed",
        message:
          ["23502", "PGRST204", "42703"].includes(createErr.code ?? "")
            ? "Booking without an email needs the latest database update (migration 20261117_contact_preferences)."
            : "Could not create the client record. Please try again.",
      };
    }
    customerId = created.id;
  } else if (trusted && Object.keys(prefPatch).length > 0) {
    // Existing client matched by phone: the owner's preference still applies.
    await supabaseAdmin.from("customers").update(prefPatch).eq("id", customerId);
  }

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("bookings")
    .insert({
      customer_id: customerId,
      customer_first_name: input.fname,
      customer_last_name: input.lname,
      customer_email: input.email ? input.email.trim() : null,
      customer_phone: input.phone,
      customer_gender: input.gender ?? null,
      treatment_id: service.bookingId,
      treatment_name: treatmentName,
      treatment_price: treatmentPrice,
      booking_date: input.date,
      booking_time: slotTime,
      duration_minutes: durationMinutes,
      // Both the link to the voucher AND the revenue marker — dashboard and
      // lifetime-spend queries exclude rows where this is set, because that
      // money was counted once when the voucher was issued.
      voucher_id: input.voucher?.id ?? null,
      message: input.message?.trim() || null,
      status: options.status,
      // Only sent when true so pre-migration databases keep accepting inserts.
      ...(options.suppressComms ? { suppress_comms: true } : {}),
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("[booking] supabase insert failed", insertError.code, insertError.message);
    // Voucher conflict FIRST. bookings_voucher_active_unique is also a 23505,
    // and the slot branch below matches on the generic text "duplicate key", so
    // if these were the other way round a voucher clash would be reported to
    // the customer as "that time slot was just taken" — sending them off to
    // pick another time that would fail in exactly the same way.
    //
    // Do NOT release the voucher claim on this branch (the route honours that):
    // hitting this index means a LIVE booking already links this voucher, so
    // the voucher is legitimately redeemed. Releasing would leave an active
    // voucher attached to a live booking — the very state the index prevents.
    const code = (insertError as { code?: string }).code ?? "";
    if (code === "PGRST204" || code === "42703" || code === "23502") {
      return {
        ok: false,
        status: 500,
        error: "migration_required",
        message:
          "This kind of booking needs the latest database update (migration 20261117_contact_preferences). Ask your developer, or book with an email address for now.",
      };
    }
    if (
      /bookings_voucher_active_unique/i.test(insertError.message ?? "") ||
      /bookings_voucher_active_unique/i.test(
        (insertError as { details?: string }).details ?? ""
      )
    ) {
      return {
        ok: false,
        status: 409,
        error: "voucher_conflict",
        message:
          "That gift voucher has just been used for another booking. Please get in touch and we'll sort it out.",
      };
    }
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
  // Copying consent forward is only allowed for a proven identity — otherwise
  // anyone could create a booking carrying someone else's signed consent.
  if (input.detailsUnchanged === true && customerId && trusted) {
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

  // When we're asking for the consultation, word it as "review & confirm" for a
  // returning client who already has one on file (the form will be pre-filled).
  let returningConsult = false;
  if (includeConsultationCTA && customerId) {
    returningConsult = await customerHasConsultation(supabaseAdmin, customerId);
  }

  try {
    const customerHtml = await render(
      BookingConfirmation({
        voucherCode: input.voucher?.code ?? null,
        firstName: input.fname,
        treatmentName,
        bookingDate: dateLong,
        bookingTime: timeNice,
        treatmentPrice,
        bookingId: inserted.id,
        siteUrl,
        includeConsultationCTA,
        returningConsult,
      })
    );

    const sends: Promise<{ error: unknown }>[] = [
      sendCustomerEmail(resend, inserted.id, {
        from: FROM,
        to: input.email ?? "",
        replyTo: OWNER_TO,
        subject: "Your reservation at The Potter Sanctuary",
        html: customerHtml,
      }) as Promise<{ error: unknown }>,
    ];

    if (options.sendOwnerNotification) {
      const ownerHtml = await render(
        OwnerNotification({
          voucherCode: input.voucher?.code ?? null,
          firstName: input.fname,
          lastName: input.lname,
          phone: input.phone,
          customerEmail: input.email ?? "—",
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
          replyTo: input.email || undefined,
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
