import { NextResponse } from "next/server";
import { Resend } from "resend";
import { render } from "@react-email/render";
import ReviewRequest from "@/emails/ReviewRequest";
import { supabaseAdmin } from "@/lib/supabase";
import { durationMinutesForTreatmentId } from "@/lib/services";
import { customerHasReviewed } from "@/lib/reviews";

export const dynamic = "force-dynamic";

const FROM = "The Potter Sanctuary <hello@thepottersanctuary.co.uk>";
const REPLY_TO = "hello@thepottersanctuary.co.uk";

// Hourly cron (feature-flagged). When REVIEWS_ENABLED === 'true', emails a
// review request to customers whose confirmed appointment ended 15–75
// minutes ago and who haven't been asked yet. Disabled by default.
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

  if (process.env.REVIEWS_ENABLED !== "true") {
    return NextResponse.json({ ok: true, skipped: "feature_flag_off" });
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
  // Appointments that *ended* 15–75 min ago could have started up to
  // (75 + treatment-length) minutes ago. We pull a generous window by
  // date and filter precisely in JS using each treatment's duration.
  const todayIso = now.toISOString().slice(0, 10);
  const yesterdayIso = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const { data: candidates, error } = await supabaseAdmin
    .from("bookings")
    .select(
      "id, customer_id, customer_first_name, customer_email, treatment_id, treatment_name, booking_date, booking_time, status, cancelled_at, review_email_sent_at"
    )
    .gte("booking_date", yesterdayIso)
    .lte("booking_date", todayIso)
    .eq("status", "confirmed")
    .is("cancelled_at", null)
    .is("review_email_sent_at", null);

  if (error) {
    console.error("[cron review-requests] query failed", JSON.stringify(error));
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }

  const rows = candidates ?? [];
  const resend = new Resend(apiKey);
  const siteUrl = new URL(req.url).origin;

  let sent = 0;
  let skipped = 0;
  for (const b of rows) {
    const durationMin = durationMinutesForTreatmentId(b.treatment_id) ?? 60;
    const startedAt = new Date(`${b.booking_date}T${b.booking_time}`);
    const endedAt = new Date(startedAt.getTime() + durationMin * 60 * 1000);
    const minsSinceEnd = (now.getTime() - endedAt.getTime()) / (60 * 1000);
    if (minsSinceEnd < 15 || minsSinceEnd > 75) {
      skipped++;
      continue;
    }

    // Customer-level guard: never ask someone who has already left a review on
    // any of their bookings. We intentionally do NOT set review_email_sent_at
    // here — that column means "a request was actually sent"; the 15–75 min
    // window naturally bounds re-evaluation to a few cheap reads.
    if (
      await customerHasReviewed(supabaseAdmin, {
        customerId: b.customer_id,
        email: b.customer_email,
      })
    ) {
      skipped++;
      continue;
    }

    try {
      const html = await render(
        ReviewRequest({
          firstName: b.customer_first_name,
          treatmentName: b.treatment_name,
          bookingId: b.id,
          siteUrl,
        })
      );
      const result = await resend.emails.send({
        from: FROM,
        to: b.customer_email,
        replyTo: REPLY_TO,
        subject: `How was your ${b.treatment_name}? — The Potter Sanctuary`,
        html,
      });
      if (result.error) {
        console.error(
          "[cron review-requests] Resend error:",
          JSON.stringify(result.error)
        );
        continue;
      }
      await supabaseAdmin
        .from("bookings")
        .update({ review_email_sent_at: new Date().toISOString() })
        .eq("id", b.id);
      sent++;
    } catch (err) {
      console.error(
        "[cron review-requests] dispatch failed",
        JSON.stringify(err, Object.getOwnPropertyNames(err as object))
      );
    }
  }

  return NextResponse.json({ ok: true, candidates: rows.length, sent, skipped });
}
