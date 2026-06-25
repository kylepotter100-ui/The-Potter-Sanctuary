import { Resend } from "resend";
import { render } from "@react-email/render";
import RescheduleConfirmation from "@/emails/RescheduleConfirmation";
import OwnerRescheduleNotice from "@/emails/OwnerRescheduleNotice";
import { supabaseAdmin } from "@/lib/supabase";
import { siteConfig } from "@/lib/site";
import { validateSlotAvailable } from "@/lib/availability";
import { durationMinutesForTreatmentId } from "@/lib/services";
import { formatLongDate, formatTime12h } from "@/lib/format";
import { minutesUntilUk } from "@/lib/uk-time";

// ============================================================================
// Single home for booking reschedule — shared by the customer route
// (app/api/bookings/[id]/reschedule) and the admin route
// (app/api/admin/bookings/[id]/reschedule). Moving a booking is a single atomic
// UPDATE of booking_date/booking_time: the OLD slot frees and the NEW slot is
// occupied in one step, guarded by the bookings_no_overlap exclusion constraint.
// ============================================================================

const FROM = "The Potter Sanctuary <hello@thepottersanctuary.co.uk>";
const OWNER_TO = "hello@thepottersanctuary.co.uk";

export type RescheduleInput = {
  bookingId: string;
  newDate: string; // YYYY-MM-DD
  newTime: string; // HH:MM or HH:MM:SS
  by: "customer" | "owner";
  // When set (customer flow), the atomic claim is scoped to this customer so a
  // booking can only be moved by its owner.
  requireCustomerId?: string;
};

export type RescheduleResult =
  | { ok: true; id: string }
  | { ok: false; status: number; error: string; message?: string };

export async function rescheduleBooking(
  input: RescheduleInput
): Promise<RescheduleResult> {
  if (!supabaseAdmin) {
    return { ok: false, status: 500, error: "Server not configured" };
  }
  const admin = supabaseAdmin;
  const adminMode = input.by === "owner";
  const newSlot =
    input.newTime.length === 5 ? `${input.newTime}:00` : input.newTime;

  const { data: booking, error: bErr } = await admin
    .from("bookings")
    .select(
      "id, customer_id, customer_first_name, customer_last_name, customer_email, customer_phone, treatment_id, treatment_name, duration_minutes, booking_date, booking_time, status"
    )
    .eq("id", input.bookingId)
    .maybeSingle();

  if (bErr || !booking) {
    return { ok: false, status: 404, error: "Booking not found" };
  }
  if (input.requireCustomerId && booking.customer_id !== input.requireCustomerId) {
    return { ok: false, status: 403, error: "Forbidden" };
  }
  if (booking.status === "cancelled") {
    return {
      ok: false,
      status: 409,
      error: "cancelled",
      message: "This booking has been cancelled and can't be rescheduled.",
    };
  }

  // Customer 15-minute cut-off on the CURRENT start (same rule as cancel).
  if (
    input.by === "customer" &&
    minutesUntilUk(booking.booking_date, booking.booking_time) < 15
  ) {
    return {
      ok: false,
      status: 400,
      error: "too_late",
      message:
        "This booking is too close to the appointment time to reschedule online. Please contact us at hello@thepottersanctuary.co.uk.",
    };
  }

  const duration =
    (booking.duration_minutes as number | null) ??
    durationMinutesForTreatmentId(booking.treatment_id as string) ??
    60;

  // Validate the new slot — excluding THIS booking from the overlap check so it
  // doesn't clash with its own current slot (relevant when moving within a day).
  const slotCheck = await validateSlotAvailable(
    admin,
    input.newDate,
    input.newTime,
    duration,
    { adminMode, excludeBookingId: booking.id }
  );
  if (!slotCheck.ok) {
    return {
      ok: false,
      status: 409,
      error: "slot_unavailable",
      message: slotCheck.reason,
    };
  }

  // Atomic claim: move the booking, and reset the reminder dedupe flags so the
  // 24h / consultation reminders re-fire for the NEW time.
  let updateQ = admin
    .from("bookings")
    .update({
      booking_date: input.newDate,
      booking_time: newSlot,
      appointment_reminder_sent_at: null,
      consultation_reminder_sent_at: null,
    })
    .eq("id", booking.id)
    .neq("status", "cancelled");
  if (input.requireCustomerId) {
    updateQ = updateQ.eq("customer_id", input.requireCustomerId);
  }

  const { data: updated, error: uErr } = await updateQ.select("id");

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
          "Sorry, that time was just taken — please pick another slot.",
      };
    }
    console.error("[reschedule] update failed", JSON.stringify(uErr));
    return { ok: false, status: 500, error: "Could not reschedule the booking" };
  }
  if (!updated || updated.length === 0) {
    return {
      ok: false,
      status: 409,
      error: "conflict",
      message: "This booking can no longer be rescheduled.",
    };
  }

  // Best-effort emails: customer always gets a reschedule confirmation; the
  // owner is notified only when the CUSTOMER moved it (the owner already knows
  // when they do it themselves).
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    const resend = new Resend(apiKey);
    const siteUrl = siteConfig.url;
    const prevDateLong = formatLongDate(booking.booking_date);
    const prevTimeNice = formatTime12h(booking.booking_time);
    const newDateLong = formatLongDate(input.newDate);
    const newTimeNice = formatTime12h(input.newTime);
    try {
      const customerHtml = await render(
        RescheduleConfirmation({
          firstName: booking.customer_first_name,
          treatmentName: booking.treatment_name,
          bookingDate: newDateLong,
          bookingTime: newTimeNice,
          previousDate: prevDateLong,
          previousTime: prevTimeNice,
          siteUrl,
        })
      );
      const sends: Promise<{ error: unknown }>[] = [
        resend.emails.send({
          from: FROM,
          to: booking.customer_email,
          replyTo: OWNER_TO,
          subject: "Your appointment has been rescheduled — The Potter Sanctuary",
          html: customerHtml,
        }) as Promise<{ error: unknown }>,
      ];
      if (input.by === "customer") {
        const ownerHtml = await render(
          OwnerRescheduleNotice({
            firstName: booking.customer_first_name,
            lastName: booking.customer_last_name,
            treatmentName: booking.treatment_name,
            bookingDate: newDateLong,
            bookingTime: newTimeNice,
            previousDate: prevDateLong,
            previousTime: prevTimeNice,
            customerEmail: booking.customer_email,
            customerPhone: booking.customer_phone,
            by: input.by,
            siteUrl,
          })
        );
        sends.push(
          resend.emails.send({
            from: FROM,
            to: OWNER_TO,
            replyTo: booking.customer_email,
            subject: `Rescheduled — ${booking.treatment_name} — ${booking.customer_first_name} ${booking.customer_last_name}`,
            html: ownerHtml,
          }) as Promise<{ error: unknown }>
        );
      }
      const results = await Promise.all(sends);
      for (const r of results) {
        if (r.error) console.error("[reschedule] Resend error:", JSON.stringify(r.error));
      }
    } catch (err) {
      console.error(
        "[reschedule] Resend error:",
        JSON.stringify(err, Object.getOwnPropertyNames(err as object))
      );
    }
  }

  return { ok: true, id: booking.id };
}
