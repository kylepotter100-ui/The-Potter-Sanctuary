import { Resend } from "resend";
import { render } from "@react-email/render";
import TreatmentChanged from "@/emails/TreatmentChanged";
import OwnerTreatmentChangeNotice from "@/emails/OwnerTreatmentChangeNotice";
import { supabaseAdmin } from "@/lib/supabase";
import { siteConfig } from "@/lib/site";
import { validateSlotAvailable } from "@/lib/availability";
import { services } from "@/lib/services";
import { formatLongDate, formatTime12h } from "@/lib/format";

// ============================================================================
// Single home for an owner-side booking AMENDMENT: changing which treatment a
// booking is for, optionally moving it at the same time.
//
// Why this is not just a label change: treatment determines duration, and
// duration determines whether the booking still fits. A 30 -> 60 min upgrade
// can collide with the next appointment or run past close, so the new duration
// is re-validated through the shared slot engine (lib/availability.ts) with
// THIS booking excluded from the overlap check — otherwise it always clashes
// with its own current slot.
//
// The write is a single atomic UPDATE guarded by bookings_no_overlap; an
// exclusion violation (23P01) surfaces as a friendly 409, exactly as in
// lib/booking-create.ts and lib/booking-reschedule.ts.
// ============================================================================

const FROM = "The Potter Sanctuary <hello@thepottersanctuary.co.uk>";
const OWNER_TO = "hello@thepottersanctuary.co.uk";

export type AmendTreatmentInput = {
  bookingId: string;
  /** services[].bookingId — the treatment to change TO. */
  newTreatmentId: string;
  /** Optional move; defaults to the booking's current date/time. */
  newDate?: string; // YYYY-MM-DD
  newTime?: string; // HH:MM or HH:MM:SS
};

export type AmendTreatmentResult =
  | { ok: true; id: string }
  | { ok: false; status: number; error: string; message?: string };

export async function changeBookingTreatment(
  input: AmendTreatmentInput
): Promise<AmendTreatmentResult> {
  if (!supabaseAdmin) {
    return { ok: false, status: 500, error: "Server not configured" };
  }
  const admin = supabaseAdmin;

  const { data: booking, error: bErr } = await admin
    .from("bookings")
    .select(
      "id, customer_first_name, customer_last_name, customer_email, customer_phone, treatment_id, treatment_name, treatment_price, duration_minutes, booking_date, booking_time, status"
    )
    .eq("id", input.bookingId)
    .maybeSingle();

  if (bErr || !booking) {
    return { ok: false, status: 404, error: "Booking not found" };
  }
  if (booking.status === "cancelled") {
    return {
      ok: false,
      status: 409,
      error: "cancelled",
      message: "This booking has been cancelled and can't be changed.",
    };
  }

  // Treatment truth comes from lib/services.ts, never the client payload — the
  // request only supplies an id. An unknown id is a tampered/stale payload.
  const service = services.find((s) => s.bookingId === input.newTreatmentId);
  if (!service) {
    return { ok: false, status: 400, error: "Unknown treatment" };
  }
  const newName = `${service.name} ${service.nameEm}`.trim();
  const newPrice = Math.round(service.price);
  const newDuration = service.durationMinutes;

  const currentDate = booking.booking_date as string;
  const currentTime = (booking.booking_time as string).slice(0, 5);
  const targetDate = input.newDate ?? currentDate;
  const targetTime = (input.newTime ?? currentTime).slice(0, 5);
  const moved = targetDate !== currentDate || targetTime !== currentTime;

  if (booking.treatment_id === input.newTreatmentId && !moved) {
    return {
      ok: false,
      status: 400,
      error: "no_change",
      message: "That's already the booked treatment.",
    };
  }

  // Re-validate with the NEW duration. adminMode mirrors the owner reschedule
  // route: the owner may place a booking outside published hours, but a genuine
  // clash with another appointment is still refused (here and by the DB).
  const slotCheck = await validateSlotAvailable(
    admin,
    targetDate,
    targetTime,
    newDuration,
    { adminMode: true, excludeBookingId: booking.id }
  );
  if (!slotCheck.ok) {
    return {
      ok: false,
      status: 409,
      error: "slot_unavailable",
      message: slotCheck.reason,
    };
  }

  // Reminder dedupe flags are reset ONLY when the appointment actually moved —
  // a treatment-only change must not cause an already-sent 24h reminder to
  // re-fire (claim-then-send relies on these staying set).
  const patch: Record<string, unknown> = {
    treatment_id: service.bookingId,
    treatment_name: newName,
    treatment_price: newPrice,
    duration_minutes: newDuration,
  };
  if (moved) {
    patch.booking_date = targetDate;
    patch.booking_time = `${targetTime}:00`;
    patch.appointment_reminder_sent_at = null;
    patch.consultation_reminder_sent_at = null;
  }

  const { data: updated, error: uErr } = await admin
    .from("bookings")
    .update(patch)
    .eq("id", booking.id)
    .neq("status", "cancelled")
    .select("id");

  if (uErr) {
    const code = (uErr as { code?: string }).code;
    if (
      code === "23505" ||
      code === "23P01" ||
      /unique constraint|exclusion constraint|bookings_no_overlap|bookings_active_slot_unique/i.test(
        uErr.message ?? ""
      )
    ) {
      return {
        ok: false,
        status: 409,
        error: "slot_taken",
        message:
          "That change clashes with another booking — please pick a different time.",
      };
    }
    console.error("[amend] update failed", JSON.stringify(uErr));
    return { ok: false, status: 500, error: "Could not change the treatment" };
  }
  if (!updated || updated.length === 0) {
    return {
      ok: false,
      status: 409,
      error: "conflict",
      message: "This booking can no longer be changed.",
    };
  }

  // Best-effort emails — the DB write has already succeeded, so failures here
  // are logged, never thrown. Both the client and the owner are always told.
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    const resend = new Resend(apiKey);
    // Canonical URL only — never derived from the request (one Worker serves
    // several hostnames; a preview host once leaked into a customer email).
    const siteUrl = siteConfig.url;
    const prevName = booking.treatment_name as string;
    const prevPrice = booking.treatment_price as number;
    const prevDateLong = formatLongDate(currentDate);
    const prevTimeNice = formatTime12h(currentTime);
    const newDateLong = formatLongDate(targetDate);
    const newTimeNice = formatTime12h(targetTime);

    try {
      const customerHtml = await render(
        TreatmentChanged({
          firstName: booking.customer_first_name,
          treatmentName: newName,
          treatmentPrice: newPrice,
          bookingDate: newDateLong,
          bookingTime: newTimeNice,
          previousTreatmentName: prevName,
          previousPrice: prevPrice,
          previousDate: prevDateLong,
          previousTime: prevTimeNice,
          moved,
          siteUrl,
        })
      );
      const ownerHtml = await render(
        OwnerTreatmentChangeNotice({
          firstName: booking.customer_first_name,
          lastName: booking.customer_last_name,
          treatmentName: newName,
          treatmentPrice: newPrice,
          durationMinutes: newDuration,
          bookingDate: newDateLong,
          bookingTime: newTimeNice,
          previousTreatmentName: prevName,
          previousPrice: prevPrice,
          previousDate: prevDateLong,
          previousTime: prevTimeNice,
          moved,
          customerEmail: booking.customer_email,
          customerPhone: booking.customer_phone,
          siteUrl,
        })
      );
      const results = await Promise.all([
        resend.emails.send({
          from: FROM,
          to: booking.customer_email,
          replyTo: OWNER_TO,
          subject: "Your booking has been updated — The Potter Sanctuary",
          html: customerHtml,
        }) as Promise<{ error: unknown }>,
        resend.emails.send({
          from: FROM,
          to: OWNER_TO,
          replyTo: booking.customer_email,
          subject: `Treatment changed — ${newName} — ${booking.customer_first_name} ${booking.customer_last_name}`,
          html: ownerHtml,
        }) as Promise<{ error: unknown }>,
      ]);
      for (const r of results) {
        if (r.error) console.error("[amend] Resend error:", JSON.stringify(r.error));
      }
    } catch (err) {
      console.error(
        "[amend] Resend error:",
        JSON.stringify(err, Object.getOwnPropertyNames(err as object))
      );
    }
  }

  return { ok: true, id: booking.id };
}
