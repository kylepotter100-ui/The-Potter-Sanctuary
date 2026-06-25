import { NextResponse } from "next/server";
import { Resend } from "resend";
import { render } from "@react-email/render";
import OwnerReviewNotification from "@/emails/OwnerReviewNotification";
import { supabaseAdmin } from "@/lib/supabase";
import { siteConfig } from "@/lib/site";
import { formatLongDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const FROM = "The Potter Sanctuary <hello@thepottersanctuary.co.uk>";
const OWNER = "hello@thepottersanctuary.co.uk";

type Body = {
  booking_id?: string;
  rating?: number;
  comment?: string;
};

export async function POST(req: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 500 }
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const bookingId = body.booking_id;
  const rating = body.rating;
  const comment = (body.comment ?? "").trim() || null;

  if (
    typeof bookingId !== "string" ||
    !bookingId ||
    typeof rating !== "number" ||
    !Number.isInteger(rating) ||
    rating < 1 ||
    rating > 5
  ) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // Validate the booking exists and that a review was actually requested
  // for it (review_email_sent_at IS NOT NULL) — stops drive-by submissions.
  const { data: booking, error: bErr } = await supabaseAdmin
    .from("bookings")
    .select(
      "id, customer_id, customer_first_name, customer_last_name, treatment_name, booking_date, review_email_sent_at"
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (bErr || !booking || !booking.review_email_sent_at) {
    return NextResponse.json(
      { error: "This review link is not valid." },
      { status: 400 }
    );
  }

  const { error: insertErr } = await supabaseAdmin.from("reviews").insert({
    booking_id: booking.id,
    customer_id: booking.customer_id,
    rating,
    comment,
  });

  if (insertErr) {
    console.error("[reviews] insert failed", JSON.stringify(insertErr));
    return NextResponse.json(
      { error: "Could not save your review. Please try again." },
      { status: 500 }
    );
  }

  // Best-effort owner notification — the review is already saved, so a send
  // failure must never fail the customer's submission. Mirrors the
  // RESEND_API_KEY-missing handling used by the other email routes.
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    try {
      const stars = "★".repeat(rating);
      const html = await render(
        OwnerReviewNotification({
          firstName: booking.customer_first_name,
          lastName: booking.customer_last_name,
          treatmentName: booking.treatment_name,
          visitDate: formatLongDate(booking.booking_date),
          rating,
          comment,
          siteUrl: siteConfig.url,
        })
      );
      const resend = new Resend(apiKey);
      const result = await resend.emails.send({
        from: FROM,
        to: OWNER,
        replyTo: OWNER,
        subject: `New review — ${stars} — ${booking.customer_first_name} ${booking.customer_last_name}`,
        html,
      });
      if (result.error) {
        console.error(
          "[reviews] owner notification Resend error:",
          JSON.stringify(result.error)
        );
      }
    } catch (err) {
      console.error(
        "[reviews] owner notification dispatch failed",
        JSON.stringify(err, Object.getOwnPropertyNames(err as object))
      );
    }
  } else {
    console.error(
      "[reviews] RESEND_API_KEY missing — owner notification skipped"
    );
  }

  return NextResponse.json({ ok: true });
}
