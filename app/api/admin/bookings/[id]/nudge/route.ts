import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Resend } from "resend";
import { render } from "@react-email/render";
import ConsultationReminder from "@/emails/ConsultationReminder";
import { supabaseAdmin } from "@/lib/supabase";
import { formatLongDate, formatTime12h } from "@/lib/format";

export const dynamic = "force-dynamic";

const FROM = "The Potter Sanctuary <hello@thepottersanctuary.co.uk>";
const REPLY_TO = "hello@thepottersanctuary.co.uk";

async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  return store.get("admin_session")?.value === "authenticated";
}

// Manual "Nudge questionnaire" — re-sends the branded consultation reminder
// to a customer whose questionnaire is still outstanding. Unlike the hourly
// cron (/api/cron/reminders), this deliberately does NOT write
// consultation_reminder_sent_at: that column is the automatic cron's dedupe
// flag, and writing it here would suppress the automatic reminder. The manual
// nudge must work regardless of whether the automatic one has fired.
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
      "id, customer_first_name, customer_email, treatment_name, booking_date, booking_time, status"
    )
    .eq("id", id)
    .maybeSingle();

  if (bookingError || !booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  // Re-check at send time: if the questionnaire is already complete (a
  // consultation_responses row exists for this booking), don't send.
  const { count: consultCount, error: consultError } = await supabaseAdmin
    .from("consultation_responses")
    .select("id", { count: "exact", head: true })
    .eq("booking_id", id);

  if (consultError) {
    console.error(
      "[admin nudge] consult check failed",
      JSON.stringify(consultError)
    );
    return NextResponse.json(
      { error: "Could not check questionnaire status" },
      { status: 500 }
    );
  }

  if ((consultCount ?? 0) > 0) {
    return NextResponse.json({ ok: true, alreadyCompleted: true });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[admin nudge] RESEND_API_KEY missing — email skipped");
    return NextResponse.json(
      { error: "Email is not configured on the server" },
      { status: 500 }
    );
  }

  const resend = new Resend(apiKey);
  const siteUrl = new URL(req.url).origin;
  try {
    const html = await render(
      ConsultationReminder({
        firstName: booking.customer_first_name,
        treatmentName: booking.treatment_name,
        bookingDate: formatLongDate(booking.booking_date),
        bookingTime: formatTime12h(booking.booking_time),
        bookingId: booking.id,
        siteUrl,
      })
    );
    const result = await resend.emails.send({
      from: FROM,
      to: booking.customer_email,
      replyTo: REPLY_TO,
      subject: "A friendly reminder — please complete your consultation",
      html,
    });
    if (result.error) {
      console.error("[admin nudge] Resend error:", JSON.stringify(result.error));
      return NextResponse.json(
        { error: "Could not send the reminder email" },
        { status: 502 }
      );
    }
  } catch (err) {
    console.error(
      "[admin nudge] dispatch failed",
      JSON.stringify(err, Object.getOwnPropertyNames(err as object))
    );
    return NextResponse.json(
      { error: "Could not send the reminder email" },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, sent: true });
}
