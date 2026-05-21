import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

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
    .select("id, customer_id, review_email_sent_at")
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

  return NextResponse.json({ ok: true });
}
