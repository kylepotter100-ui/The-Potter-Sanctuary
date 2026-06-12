import { NextResponse } from "next/server";
import { Resend } from "resend";
import { render } from "@react-email/render";
import ConsultationReminder from "@/emails/ConsultationReminder";
import { supabaseAdmin } from "@/lib/supabase";
import { siteConfig } from "@/lib/site";
import { formatLongDate, formatTime12h } from "@/lib/format";
import { addDaysIso, ukWallTimeToUtc } from "@/lib/uk-time";

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
  // SQL prefilter is coarse (dates only) and padded ±1 day so the UTC↔UK
  // offset can never exclude a candidate; the exact DST-aware gate is the
  // hoursOut check below.
  const now = new Date();
  const windowStart = new Date(now.getTime() + 12 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 13 * 60 * 60 * 1000);
  const startIso = addDaysIso(windowStart.toISOString().slice(0, 10), -1);
  const endIso = addDaysIso(windowEnd.toISOString().slice(0, 10), 1);

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
  const siteUrl = siteConfig.url;

  let sent = 0;
  let skipped = 0;
  for (const b of rows) {
    const bookingDateTime = ukWallTimeToUtc(b.booking_date, b.booking_time);
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
      // Mark as sent so we don't keep checking each hour (conditional, so a
      // concurrent run can't fight over it).
      await supabaseAdmin
        .from("bookings")
        .update({ consultation_reminder_sent_at: new Date().toISOString() })
        .eq("id", b.id)
        .is("consultation_reminder_sent_at", null);
      skipped++;
      continue;
    }

    // CLAIM-then-send (mirrors morning-summary / admin request-review): set
    // the dedupe flag atomically BEFORE sending so a concurrent or retried
    // run can never double-send; release the claim if the send fails so the
    // next hourly run retries. The old send-then-mark order duplicated the
    // email whenever the send succeeded but the mark didn't land.
    const { data: claimed } = await supabaseAdmin
      .from("bookings")
      .update({ consultation_reminder_sent_at: new Date().toISOString() })
      .eq("id", b.id)
      .is("consultation_reminder_sent_at", null)
      .select("id");
    if (!claimed || claimed.length === 0) {
      skipped++;
      continue;
    }
    const unclaim = () =>
      supabaseAdmin!
        .from("bookings")
        .update({ consultation_reminder_sent_at: null })
        .eq("id", b.id);

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
        await unclaim();
        continue;
      }
      sent++;
    } catch (err) {
      console.error(
        "[cron reminders] dispatch failed",
        JSON.stringify(err, Object.getOwnPropertyNames(err as object))
      );
      await unclaim();
    }
  }

  return NextResponse.json({
    ok: true,
    candidates: rows.length,
    sent,
    skipped,
  });
}
