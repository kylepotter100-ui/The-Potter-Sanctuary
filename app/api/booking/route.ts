import { NextResponse } from "next/server";
import { Resend } from "resend";
import BookingConfirmation from "@/emails/BookingConfirmation";
import OwnerNotification from "@/emails/OwnerNotification";
import { supabaseAdmin } from "@/lib/supabase";
import { formatLongDate, formatTime12h, formatTimestamp } from "@/lib/format";

type Payload = {
  date: string;
  dateLabel: string;
  time: string;
  service: { svc: string; name: string; price: number; duration: string };
  gender: string | null;
  fname: string;
  lname: string;
  phone: string;
  email: string;
  message?: string;
};

const FROM = "The Potter Sanctuary <bookings@thepottersanctuary.co.uk>";
const OWNER_TO = "hello@thepottersanctuary.co.uk";

export async function POST(req: Request) {
  let payload: Payload;
  try {
    payload = (await req.json()) as Payload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const required = [
    payload?.date,
    payload?.time,
    payload?.service?.name,
    payload?.service?.svc,
    payload?.fname,
    payload?.lname,
    payload?.phone,
    payload?.email,
  ];
  if (
    required.some((v) => !v) ||
    !/\S+@\S+\.\S+/.test(payload.email) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(payload.date) ||
    !/^\d{2}:\d{2}(:\d{2})?$/.test(payload.time)
  ) {
    return NextResponse.json(
      { error: "Missing or invalid required fields" },
      { status: 400 }
    );
  }

  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Booking storage is not configured on the server" },
      { status: 500 }
    );
  }

  const slotTime = payload.time.length === 5 ? `${payload.time}:00` : payload.time;

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("bookings")
    .insert({
      customer_first_name: payload.fname,
      customer_last_name: payload.lname,
      customer_email: payload.email,
      customer_phone: payload.phone,
      customer_gender: payload.gender ?? null,
      treatment_id: payload.service.svc,
      treatment_name: payload.service.name,
      treatment_price: Math.round(payload.service.price),
      booking_date: payload.date,
      booking_time: slotTime,
      message: payload.message?.trim() || null,
      status: "pending",
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("[booking] supabase insert failed", insertError);
    return NextResponse.json(
      { error: "Could not save your booking. Please try again." },
      { status: 500 }
    );
  }

  // Email sending is best-effort: if Resend is misconfigured or fails, the
  // booking is already saved and the user gets a success response. We log the
  // failure so the studio can chase up via the admin panel.
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[booking] RESEND_API_KEY missing — booking saved without email");
    return NextResponse.json({ ok: true, id: inserted.id });
  }

  const resend = new Resend(apiKey);

  const dateLong = formatLongDate(payload.date);
  const timeNice = formatTime12h(payload.time);

  try {
    const results = await Promise.all([
      resend.emails.send({
        from: FROM,
        to: payload.email,
        replyTo: OWNER_TO,
        subject: "Your reservation at The Potter Sanctuary",
        react: BookingConfirmation({
          firstName: payload.fname,
          treatmentName: payload.service.name,
          bookingDate: dateLong,
          bookingTime: timeNice,
          treatmentPrice: payload.service.price,
        }),
      }),
      resend.emails.send({
        from: FROM,
        to: OWNER_TO,
        replyTo: payload.email,
        subject: `New booking — ${payload.service.name} — ${payload.fname} ${payload.lname}`,
        react: OwnerNotification({
          firstName: payload.fname,
          lastName: payload.lname,
          phone: payload.phone,
          customerEmail: payload.email,
          treatmentName: payload.service.name,
          bookingDate: dateLong,
          bookingTime: timeNice,
          treatmentPrice: payload.service.price,
          gender: payload.gender ?? "—",
          message: payload.message ?? "",
          timestamp: formatTimestamp(),
        }),
      }),
    ]);
    for (const r of results) {
      if (r.error) console.error("[booking] resend send error", r.error);
    }
  } catch (err) {
    console.error("[booking] email dispatch threw", err);
  }

  return NextResponse.json({ ok: true, id: inserted.id });
}
