import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Resend } from "resend";
import { render } from "@react-email/render";
import ReviewRequest from "@/emails/ReviewRequest";
import { supabaseAdmin } from "@/lib/supabase";
import { siteConfig } from "@/lib/site";
import { customerHasReviewed } from "@/lib/reviews";

export const dynamic = "force-dynamic";

const FROM = "The Potter Sanctuary <hello@thepottersanctuary.co.uk>";
const REPLY_TO = "hello@thepottersanctuary.co.uk";

async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  return store.get("admin_session")?.value === "authenticated";
}

// Manual "Request review" — sends the branded review-request email and sets
// review_email_sent_at on the booking. That flag is REQUIRED: /review and
// /api/reviews validate it before accepting a submission, so the CTA only
// works once it's set, and it also dedupes against the automatic review cron.
// Works regardless of REVIEWS_ENABLED (that flag only gates the cron). The
// send-time re-checks below keep server and button state in agreement even if
// the admin page is stale.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Supabase is not configured on the server" },
      { status: 500 }
    );
  }

  const { id } = await params;

  const { data: booking, error: bookingError } = await supabaseAdmin
    .from("bookings")
    .select(
      "id, customer_id, customer_first_name, customer_email, treatment_name, status, review_email_sent_at"
    )
    .eq("id", id)
    .maybeSingle();

  if (bookingError || !booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  if (booking.status === "cancelled") {
    return NextResponse.json(
      { error: "Cannot request a review for a cancelled booking" },
      { status: 400 }
    );
  }

  // 1) Already left a review? Don't ask again.
  const { count: reviewCount, error: reviewError } = await supabaseAdmin
    .from("reviews")
    .select("id", { count: "exact", head: true })
    .eq("booking_id", id);

  if (reviewError) {
    console.error(
      "[admin request-review] review check failed",
      JSON.stringify(reviewError)
    );
    return NextResponse.json(
      { error: "Could not check review status" },
      { status: 500 }
    );
  }
  if ((reviewCount ?? 0) > 0) {
    return NextResponse.json({ ok: true, alreadyReviewed: true });
  }

  // 1b) Customer-level guard: skip if this customer has reviewed on ANY of
  // their bookings (matched by email, plus customer_id), so a repeat customer
  // is never asked again. No send, no write.
  if (
    await customerHasReviewed(supabaseAdmin, {
      customerId: booking.customer_id,
      email: booking.customer_email,
    })
  ) {
    return NextResponse.json({ ok: true, alreadyReviewed: true });
  }

  // 2) Atomic claim: only the request that flips review_email_sent_at from
  // NULL → now() proceeds to send, so we never double-ask.
  const nowIso = new Date().toISOString();
  const { data: claimedRows, error: claimError } = await supabaseAdmin
    .from("bookings")
    .update({ review_email_sent_at: nowIso })
    .eq("id", id)
    .is("review_email_sent_at", null)
    .select("id");

  if (claimError) {
    console.error(
      "[admin request-review] claim failed",
      JSON.stringify(claimError)
    );
    return NextResponse.json(
      { error: "Could not request a review" },
      { status: 500 }
    );
  }
  if (!claimedRows || claimedRows.length === 0) {
    // review_email_sent_at was already set by the cron or a prior request.
    return NextResponse.json({ ok: true, alreadyRequested: true });
  }

  // 3) The claim won — send the branded review request.
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    const resend = new Resend(apiKey);
    const siteUrl = siteConfig.url;
    try {
      const html = await render(
        ReviewRequest({
          firstName: booking.customer_first_name,
          treatmentName: booking.treatment_name,
          bookingId: booking.id,
          siteUrl,
        })
      );
      const result = await resend.emails.send({
        from: FROM,
        to: booking.customer_email,
        replyTo: REPLY_TO,
        subject: `How was your ${booking.treatment_name}? — The Potter Sanctuary`,
        html,
      });
      if (result.error) {
        console.error(
          "[admin request-review] Resend error:",
          JSON.stringify(result.error)
        );
      }
    } catch (err) {
      console.error(
        "[admin request-review] dispatch failed",
        JSON.stringify(err, Object.getOwnPropertyNames(err as object))
      );
    }
  } else {
    console.error(
      "[admin request-review] RESEND_API_KEY missing — email skipped"
    );
  }

  return NextResponse.json({ ok: true, sent: true });
}
