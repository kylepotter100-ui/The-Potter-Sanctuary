import { NextResponse } from "next/server";
import { Resend } from "resend";
import { render } from "@react-email/render";
import CustomerCancellationConfirmation from "@/emails/CustomerCancellationConfirmation";
import OwnerCancellationByCustomer from "@/emails/OwnerCancellationByCustomer";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase";
import { revertVoucherRedemption } from "@/lib/voucher-revert";
import { siteConfig } from "@/lib/site";
import { formatLongDate, formatTime12h } from "@/lib/format";
import { minutesUntilUk } from "@/lib/uk-time";

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

  // Cancellation cut-off: no online cancellations within 15 minutes of the
  // appointment start. Enforced server-side regardless of what the UI shows.
  // DST-aware: booking_time is a UK wall time, not UTC (lib/uk-time.ts).
  const minutesUntil = minutesUntilUk(booking.booking_date, booking.booking_time);
  if (minutesUntil < 15) {
    return NextResponse.json(
      {
        error: "too_late",
        message:
          "This booking is too close to the appointment time to cancel online. Please contact us at hello@thepottersanctuary.co.uk if you need to cancel.",
      },
      { status: 400 }
    );
  }

  // Claim-based conditional update: only the request that actually flips the
  // row from non-cancelled → cancelled proceeds to send emails. Guards against
  // a simultaneous customer + owner cancellation both "winning".
  const { data: updatedRows, error: updateError } = await supabaseAdmin
    .from("bookings")
    .update({
      status: "cancelled",
      cancellation_reason: reason,
      cancelled_at: new Date().toISOString(),
      cancelled_by: "customer",
    })
    .eq("id", id)
    .eq("customer_id", customer.id)
    .neq("status", "cancelled")
    .select("id, voucher_id");

  if (updateError) {
    console.error("[cancel] update failed", JSON.stringify(updateError));
    return NextResponse.json(
      { error: "Could not cancel the booking" },
      { status: 500 }
    );
  }

  if (!updatedRows || updatedRows.length === 0) {
    // Lost the race (already cancelled) or no longer owned by this customer.
    return NextResponse.json(
      {
        error: "already_cancelled",
        message: "This booking has already been cancelled.",
      },
      { status: 409 }
    );
  }

  // Voucher-funded booking: return the voucher to 'active' so the client can
  // rebook with the same code. ORDERING IS LOAD-BEARING — the booking is
  // already cancelled above; reverting first would leave an active voucher
  // attached to a still-live booking, letting one code fund two bookings.
  // `voucher_id` comes from the conditional update's own select, never from a
  // pre-fetch, so it belongs to the row THIS request cancelled. Best-effort:
  // a failure here must not fail a cancellation the customer has been told
  // succeeded (see lib/voucher-revert.ts).
  const cancelledVoucherId = updatedRows[0]?.voucher_id as string | null;
  if (cancelledVoucherId) {
    await revertVoucherRedemption(supabaseAdmin, cancelledVoucherId);
  }

  // Fire-and-forget emails. Failures are logged but don't fail the request,
  // since the booking is already cancelled in the database. Only the request
  // that won the conditional update reaches here, so emails send exactly once.
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    const resend = new Resend(apiKey);
    const siteUrl = siteConfig.url;
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
