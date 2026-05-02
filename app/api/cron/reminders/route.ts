import { NextResponse } from "next/server";
import { Resend } from "resend";
import { render } from "@react-email/render";
import ConsultationReminder from "@/emails/ConsultationReminder";
import { supabaseAdmin } from "@/lib/supabase";
import { formatLongDate, formatTime12h } from "@/lib/format";

export const dynamic = "force-dynamic";

const FROM = "The Potter Sanctuary <hello@thepottersanctuary.co.uk>";
const REPLY_TO = "hello@thepottersanctuary.co.uk";

// Cron-triggered reminder dispatcher. Hits the route hourly and emails any
// confirmed/pending booking that's 12–13 hours out where the customer
// hasn't yet completed the consultation questionnaire.
//
// Authenticated via a CRON_SECRET bearer. The worker-level scheduled()
// handler calls this route through the WORKER_SELF_REFERENCE binding
// passing the secret in the Authorization header.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 }
    );
  }
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 500 }
    );
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "RESEND_API_KEY missing" },
      { status: 500 }
    );
  }

  // Reminder window: 12–13 hours from now. We compute date+time bounds and
  // filter in SQL on booking_date (range), then narrow further in JS by
  // exact booking_time.
  const now = new Date();
  const windowStart = new Date(now.getTime() + 12 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 13 * 60 * 60 * 1000);
  const startIso = windowStart.toISOString().slice(0, 10);
  const endIso = windowEnd.toISOString().slice(0, 10);

  const { data: candidates, error } = await supabaseAdmin
    .from("bookings")
    .select(
      "id, customer_id, customer_first_name, customer_email, treatment_name, booking_date, booking_time, status, created_at, consultation_reminder_sent_at"
    )
    .gte("booking_date", startIso)
    .lte("booking_date", endIso)
    .in("status", ["pending", "confirmed"])
    .is("consultation_reminder_sent_at", null);

  if (error) {
    console.error("[cron reminders] query failed", JSON.stringify(error));
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = candidates ?? [];
  const resend = new Resend(apiKey);
  const siteUrl = new URL(req.url).origin;

  let sent = 0;
  let skipped = 0;
  for (const b of rows) {
    const bookingDateTime = new Date(`${b.booking_date}T${b.booking_time}`);
    const ms = bookingDateTime.getTime() - now.getTime();
    const hoursOut = ms / (60 * 60 * 1000);
    if (hoursOut < 12 || hoursOut > 13) {
      skipped++;
      continue;
    }

    // Only remind if the customer had reasonable opportunity to complete
    // the questionnaire — booking created at least 12 hours before the
    // appointment.
    const created = new Date(b.created_at as string);
    if (bookingDateTime.getTime() - created.getTime() < 12 * 60 * 60 * 1000) {
      skipped++;
      continue;
    }

    // Skip if a consultation has been completed for this booking.
    const { count: consultCount } = await supabaseAdmin
      .from("consultation_responses")
      .select("id", { count: "exact", head: true })
      .eq("booking_id", b.id);
    if ((consultCount ?? 0) > 0) {
      // Mark as sent so we don't keep checking each hour.
      await supabaseAdmin
        .from("bookings")
        .update({ consultation_reminder_sent_at: new Date().toISOString() })
        .eq("id", b.id);
      skipped++;
      continue;
    }

    try {
      const html = await render(
        ConsultationReminder({
          firstName: b.customer_first_name,
          treatmentName: b.treatment_name,
          bookingDate: formatLongDate(b.booking_date),
          bookingTime: formatTime12h(b.booking_time),
          bookingId: b.id,
          siteUrl,
        })
      );
      const result = await resend.emails.send({
        from: FROM,
        to: b.customer_email,
        replyTo: REPLY_TO,
        subject: "A friendly reminder — please complete your consultation",
        html,
      });
      if (result.error) {
        console.error(
          "[cron reminders] Resend error:",
          JSON.stringify(result.error)
        );
        continue;
      }
      await supabaseAdmin
        .from("bookings")
        .update({ consultation_reminder_sent_at: new Date().toISOString() })
        .eq("id", b.id);
      sent++;
    } catch (err) {
      console.error(
        "[cron reminders] dispatch failed",
        JSON.stringify(err, Object.getOwnPropertyNames(err as object))
      );
    }
  }

  return NextResponse.json({
    ok: true,
    candidates: rows.length,
    sent,
    skipped,
  });
}
