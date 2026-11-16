import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase";
import { bookingsClashingWithBlock, segmentsInRange } from "@/lib/time-blocks";

export const dynamic = "force-dynamic";

type Body = { date?: string; from?: string; to?: string; action?: "block" | "clear" };

// Block out part of a day (lunch, school run, appointments) or clear such a
// block. "block" closes every 15-minute segment in [from, to) for that date;
// "clear" removes the per-date overrides in the range so the day returns to
// its normal weekly pattern. Refuses to block over an existing booking.
export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { date, from, to, action } = body;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || (action !== "block" && action !== "clear")) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const segs = segmentsInRange(from ?? "", to ?? "");
  if (!segs) {
    return NextResponse.json(
      {
        error: "invalid_range",
        message: "Choose a start and end time on the quarter-hour, between 06:00 and 22:00, with the end after the start.",
      },
      { status: 400 }
    );
  }

  if (action === "clear") {
    const { error } = await supabaseAdmin
      .from("slot_overrides")
      .delete()
      .eq("override_date", date)
      .in("slot_time", segs.map((t) => `${t}:00`));
    if (error) {
      console.error("[time-block] clear failed", error.code, error.message);
      return NextResponse.json({ error: "Could not clear that time." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, cleared: segs.length });
  }

  const { data: dayBookings, error: bErr } = await supabaseAdmin
    .from("bookings")
    .select("id, booking_time, duration_minutes, customer_first_name, customer_last_name")
    .eq("booking_date", date)
    .in("status", ["pending", "confirmed"]);
  if (bErr) {
    console.error("[time-block] bookings read failed", bErr.code, bErr.message);
    return NextResponse.json({ error: "Could not check the diary." }, { status: 500 });
  }
  const clashes = bookingsClashingWithBlock(
    from!,
    to!,
    (dayBookings ?? []).map((b) => ({
      id: b.id as string,
      time: (b.booking_time as string).slice(0, 5),
      duration_minutes: b.duration_minutes as number,
      name: `${b.customer_first_name} ${b.customer_last_name}`,
    }))
  );
  if (clashes.length > 0) {
    return NextResponse.json(
      {
        error: "clash",
        message: `That time overlaps ${clashes
          .map((c) => `${c.name} at ${c.time}`)
          .join(", ")}. Move or cancel the booking first.`,
        clashes,
      },
      { status: 409 }
    );
  }

  const now = new Date().toISOString();
  const { error } = await supabaseAdmin.from("slot_overrides").upsert(
    segs.map((t) => ({
      override_date: date,
      slot_time: `${t}:00`,
      is_active: false,
      updated_at: now,
    })),
    { onConflict: "override_date,slot_time" }
  );
  if (error) {
    console.error("[time-block] upsert failed", error.code, error.message);
    return NextResponse.json({ error: "Could not block that time." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, blocked: segs.length });
}
