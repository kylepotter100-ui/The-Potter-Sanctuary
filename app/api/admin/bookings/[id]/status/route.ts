import { NextResponse } from "next/server";
import { Resend } from "resend";
import { render } from "@react-email/render";
import BookingConfirmed from "@/emails/BookingConfirmed";
import { supabaseAdmin } from "@/lib/supabase";
import { formatLongDate, formatTime12h } from "@/lib/format";

const VALID = new Set(["pending", "confirmed", "cancelled"]);
const FROM = "The Potter Sanctuary <hello@thepottersanctuary.co.uk>";
const REPLY_TO = "hello@thepottersanctuary.co.uk";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Supabase is not configured on the server" },
      { status: 500 }
    );
  }

  const { id } = await params;
  let body: { status?: string };
  try {
    body = (await req.json()) as { status?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const status = body.status;
  if (typeof status !== "string" || !VALID.has(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("bookings")
    .update({ status })
    .eq("id", id)
    .select(
      "id, customer_first_name, customer_email, treatment_name, treatment_price, booking_date, booking_time, status"
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Send the customer a confirmation email when the admin moves a booking to
  // 'confirmed'. Best-effort — failures here don't fail the API call.
  if (status === "confirmed" && data?.customer_email) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error("[admin status] RESEND_API_KEY missing — confirmation email skipped");
    } else {
      const resend = new Resend(apiKey);
      try {
        const html = await render(
          BookingConfirmed({
            firstName: data.customer_first_name,
            treatmentName: data.treatment_name,
            bookingDate: formatLongDate(data.booking_date),
            bookingTime: formatTime12h(data.booking_time),
            treatmentPrice: data.treatment_price,
          })
        );
        const result = await resend.emails.send({
          from: FROM,
          to: data.customer_email,
          replyTo: REPLY_TO,
          subject: "Your booking is confirmed — The Potter Sanctuary",
          html,
        });
        if (result.error) {
          console.error("[admin status] Resend error:", JSON.stringify(result.error));
        }
      } catch (err) {
        console.error(
          "[admin status] Resend error:",
          JSON.stringify(err, Object.getOwnPropertyNames(err as object))
        );
      }
    }
  }

  return NextResponse.json(data);
}
