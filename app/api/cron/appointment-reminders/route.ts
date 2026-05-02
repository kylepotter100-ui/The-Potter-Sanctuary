import { NextResponse } from "next/server";
import { Resend } from "resend";
import { render } from "@react-email/render";
import AppointmentReminder from "@/emails/AppointmentReminder";
import { supabaseAdmin } from "@/lib/supabase";
import { formatLongDate, formatTime12h } from "@/lib/format";

export const dynamic = "force-dynamic";

const FROM = "The Potter Sanctuary <hello@thepottersanctuary.co.uk>";
const REPLY_TO = "hello@thepottersanctuary.co.uk";

// Hourly cron: emails any confirmed booking that's 23–25 hours out where
// we haven't already sent the 24-hour reminder. Pending bookings are
// excluded — only confirmed bookings get this nudge.
export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 }
    );
  }
  if (req.headers.get("authorization") !== `Bearer ${expected}`) {
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

  const now = new Date();
  const startWindow = new Date(now.getTime() + 23 * 60 * 60 * 1000);
  const endWindow = new Date(now.getTime() + 25 * 60 * 60 * 1000);
  const startIso = startWindow.toISOString().slice(0, 10);
  const endIso = endWindow.toISOString().slice(0, 10);

  const { data: candidates, error } = await supabaseAdmin
    .from("bookings")
    .select(
      "id, customer_first_name, customer_email, treatment_name, booking_date, booking_time, status, cancelled_at, appointment_reminder_sent_at"
    )
    .gte("booking_date", startIso)
    .lte("booking_date", endIso)
    .eq("status", "confirmed")
    .is("cancelled_at", null)
    .is("appointment_reminder_sent_at", null);

  if (error) {
    console.error(
      "[cron appointment-reminders] query failed",
      JSON.stringify(error)
    );
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = candidates ?? [];
  const resend = new Resend(apiKey);
  const siteUrl = new URL(req.url).origin;

  let sent = 0;
  let skipped = 0;
  for (const b of rows) {
    const apptTime = new Date(`${b.booking_date}T${b.booking_time}`);
    const hoursOut = (apptTime.getTime() - now.getTime()) / (60 * 60 * 1000);
    if (hoursOut < 23 || hoursOut > 25) {
      skipped++;
      continue;
    }

    try {
      const html = await render(
        AppointmentReminder({
          firstName: b.customer_first_name,
          treatmentName: b.treatment_name,
          bookingDate: formatLongDate(b.booking_date),
          bookingTime: formatTime12h(b.booking_time),
          siteUrl,
        })
      );
      const result = await resend.emails.send({
        from: FROM,
        to: b.customer_email,
        replyTo: REPLY_TO,
        subject: "Looking forward to seeing you tomorrow — The Potter Sanctuary",
        html,
      });
      if (result.error) {
        console.error(
          "[cron appointment-reminders] Resend error:",
          JSON.stringify(result.error)
        );
        continue;
      }
      await supabaseAdmin
        .from("bookings")
        .update({ appointment_reminder_sent_at: new Date().toISOString() })
        .eq("id", b.id);
      sent++;
    } catch (err) {
      console.error(
        "[cron appointment-reminders] dispatch failed",
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
