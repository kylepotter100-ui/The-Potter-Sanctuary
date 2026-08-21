import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Resend } from "resend";
import { render } from "@react-email/render";
import BookingConfirmed from "@/emails/BookingConfirmed";
import { supabaseAdmin } from "@/lib/supabase";
import { siteConfig } from "@/lib/site";
import { formatLongDate, formatTime12h } from "@/lib/format";

// Confirm / un-confirm only. Cancellation deliberately does NOT live here:
// this route writes bare `status`, so a 'cancelled' written through it would
// carry no cancellation_reason, no cancelled_at, no cancelled_by, and would
// send no email — silently diverging from the two real cancel routes
// (app/api/bookings/[id]/cancel and app/api/admin/bookings/[id]/cancel), which
// record all of that and notify the customer. Keeping it out also means every
// cancellation passes through those two routes alone, so hooks that must run
// on cancellation can't be bypassed by a caller POSTing here.
const VALID = new Set(["pending", "confirmed"]);
const FROM = "The Potter Sanctuary <hello@thepottersanctuary.co.uk>";
const REPLY_TO = "hello@thepottersanctuary.co.uk";

async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  return store.get("admin_session")?.value === "authenticated";
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  }
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
    return NextResponse.json(
      {
        error: "invalid_status",
        message:
          "Status must be 'pending' or 'confirmed'. To cancel a booking, use the cancel route so the reason and notification are recorded.",
      },
      { status: 400 }
    );
  }

  // Conditional state transition to prevent races (e.g. admin confirms a
  // booking the customer is cancelling at the same moment):
  //  - confirm:  only from 'pending' (never resurrect a cancelled booking)
  //  - pending:  only when not already cancelled (un-confirm stays a no-op
  //              on an already-cancelled booking)
  let query = supabaseAdmin
    .from("bookings")
    .update({ status })
    .eq("id", id);
  if (status === "confirmed") {
    query = query.eq("status", "pending");
  } else {
    query = query.neq("status", "cancelled");
  }

  const { data: rows, error } = await query.select(
    "id, customer_first_name, customer_email, treatment_name, treatment_price, booking_date, booking_time, status"
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!rows || rows.length === 0) {
    // The booking wasn't in a state this transition is allowed from.
    return NextResponse.json(
      {
        error: "invalid_transition",
        message:
          status === "confirmed"
            ? "This booking can't be confirmed — it may have been cancelled."
            : "This booking can no longer be updated.",
      },
      { status: 409 }
    );
  }
  const data = rows[0];

  // Send the customer a confirmation email when the admin moves a booking to
  // 'confirmed'. Best-effort — failures here don't fail the API call.
  if (status === "confirmed" && data?.customer_email) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error("[admin status] RESEND_API_KEY missing — confirmation email skipped");
    } else {
      const resend = new Resend(apiKey);
      const siteUrl = siteConfig.url;
      try {
        const html = await render(
          BookingConfirmed({
            firstName: data.customer_first_name,
            treatmentName: data.treatment_name,
            bookingDate: formatLongDate(data.booking_date),
            bookingTime: formatTime12h(data.booking_time),
            treatmentPrice: data.treatment_price,
            siteUrl,
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
