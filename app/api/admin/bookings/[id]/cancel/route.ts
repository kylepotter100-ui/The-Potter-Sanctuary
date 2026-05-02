import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Resend } from "resend";
import { render } from "@react-email/render";
import CustomerCancellationByOwner from "@/emails/CustomerCancellationByOwner";
import { supabaseAdmin } from "@/lib/supabase";
import { formatLongDate, formatTime12h } from "@/lib/format";

export const dynamic = "force-dynamic";

const FROM = "The Potter Sanctuary <hello@thepottersanctuary.co.uk>";
const REPLY_TO = "hello@thepottersanctuary.co.uk";

type Body = { reason?: string };

async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  return store.get("admin_session")?.value === "authenticated";
}

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

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    // No body; reason is required for owner cancellations.
  }
  const reason = (body.reason ?? "").trim();
  if (!reason) {
    return NextResponse.json(
      { error: "A cancellation reason is required" },
      { status: 400 }
    );
  }

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
  if (booking.status === "cancelled") {
    return NextResponse.json({ ok: true, alreadyCancelled: true });
  }

  const { error: updateError } = await supabaseAdmin
    .from("bookings")
    .update({
      status: "cancelled",
      cancellation_reason: reason,
      cancelled_at: new Date().toISOString(),
      cancelled_by: "owner",
    })
    .eq("id", id);

  if (updateError) {
    console.error("[admin cancel] update failed", updateError);
    return NextResponse.json(
      { error: "Could not cancel the booking" },
      { status: 500 }
    );
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    const resend = new Resend(apiKey);
    const siteUrl = new URL(req.url).origin;
    try {
      const html = await render(
        CustomerCancellationByOwner({
          firstName: booking.customer_first_name,
          treatmentName: booking.treatment_name,
          bookingDate: formatLongDate(booking.booking_date),
          bookingTime: formatTime12h(booking.booking_time),
          reason,
          siteUrl,
        })
      );
      const result = await resend.emails.send({
        from: FROM,
        to: booking.customer_email,
        replyTo: REPLY_TO,
        subject: "Your booking has been cancelled — The Potter Sanctuary",
        html,
      });
      if (result.error) {
        console.error(
          "[admin cancel] Resend error:",
          JSON.stringify(result.error)
        );
      }
    } catch (err) {
      console.error(
        "[admin cancel] Resend error:",
        JSON.stringify(err, Object.getOwnPropertyNames(err as object))
      );
    }
  } else {
    console.error("[admin cancel] RESEND_API_KEY missing — email skipped");
  }

  return NextResponse.json({ ok: true });
}
