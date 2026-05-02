import { NextResponse } from "next/server";
import { Resend } from "resend";
import { render } from "@react-email/render";
import CustomerCancellationConfirmation from "@/emails/CustomerCancellationConfirmation";
import OwnerCancellationByCustomer from "@/emails/OwnerCancellationByCustomer";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";
import { formatLongDate, formatTime12h } from "@/lib/format";

export const dynamic = "force-dynamic";

const FROM = "The Potter Sanctuary <hello@thepottersanctuary.co.uk>";
const OWNER_TO = "hello@thepottersanctuary.co.uk";

type Body = { reason?: string };

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

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user || !user.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    // No body is fine — reason is optional.
  }
  const reason = (body.reason ?? "").trim() || null;

  // Verify the booking belongs to the signed-in customer before mutating.
  const { data: customer } = await supabaseAdmin
    .from("customers")
    .select("id")
    .eq("email", user.email.toLowerCase())
    .maybeSingle();

  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  const { data: booking, error: bookingError } = await supabaseAdmin
    .from("bookings")
    .select(
      "id, customer_id, customer_first_name, customer_last_name, customer_email, customer_phone, treatment_name, booking_date, booking_time, status"
    )
    .eq("id", id)
    .maybeSingle();

  if (bookingError || !booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }
  if (booking.customer_id !== customer.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
      cancelled_by: "customer",
    })
    .eq("id", id);

  if (updateError) {
    console.error("[cancel] update failed", updateError);
    return NextResponse.json(
      { error: "Could not cancel the booking" },
      { status: 500 }
    );
  }

  // Fire-and-forget emails. Failures are logged but don't fail the request,
  // since the booking is already cancelled in the database.
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    const resend = new Resend(apiKey);
    const siteUrl = new URL(req.url).origin;
    const dateLong = formatLongDate(booking.booking_date);
    const timeNice = formatTime12h(booking.booking_time);
    try {
      const [customerHtml, ownerHtml] = await Promise.all([
        render(
          CustomerCancellationConfirmation({
            firstName: booking.customer_first_name,
            treatmentName: booking.treatment_name,
            bookingDate: dateLong,
            bookingTime: timeNice,
            siteUrl,
          })
        ),
        render(
          OwnerCancellationByCustomer({
            firstName: booking.customer_first_name,
            lastName: booking.customer_last_name,
            treatmentName: booking.treatment_name,
            bookingDate: dateLong,
            bookingTime: timeNice,
            customerEmail: booking.customer_email,
            customerPhone: booking.customer_phone,
            reason,
            siteUrl,
          })
        ),
      ]);

      const results = await Promise.all([
        resend.emails.send({
          from: FROM,
          to: booking.customer_email,
          replyTo: OWNER_TO,
          subject: "Your booking has been cancelled — The Potter Sanctuary",
          html: customerHtml,
        }),
        resend.emails.send({
          from: FROM,
          to: OWNER_TO,
          replyTo: booking.customer_email,
          subject: `Cancellation — ${booking.treatment_name} — ${booking.customer_first_name} ${booking.customer_last_name}`,
          html: ownerHtml,
        }),
      ]);
      for (const r of results) {
        if (r.error) {
          console.error("[cancel] Resend error:", JSON.stringify(r.error));
        }
      }
    } catch (err) {
      console.error(
        "[cancel] Resend error:",
        JSON.stringify(err, Object.getOwnPropertyNames(err as object))
      );
    }
  } else {
    console.error("[cancel] RESEND_API_KEY missing — emails skipped");
  }

  return NextResponse.json({ ok: true });
}
