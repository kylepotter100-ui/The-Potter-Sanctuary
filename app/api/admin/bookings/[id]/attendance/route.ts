import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { supabaseAdmin } from "@/lib/supabase";
import { minutesUntilUk } from "@/lib/uk-time";

export const dynamic = "force-dynamic";

// Owner records whether the client attended. Only for confirmed bookings whose
// start time has passed (UK time). attendance=null clears a mistaken mark.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }
  const { id } = await params;
  let body: { attendance?: unknown };
  try {
    body = (await req.json()) as { attendance?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const value = body.attendance;
  if (value !== "attended" && value !== "no_show" && value !== null) {
    return NextResponse.json({ error: "Invalid attendance" }, { status: 400 });
  }

  const { data: booking } = await supabaseAdmin
    .from("bookings")
    .select("id, status, booking_date, booking_time")
    .eq("id", id)
    .maybeSingle();
  if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if (booking.status !== "confirmed") {
    return NextResponse.json(
      { error: "not_confirmed", message: "Only confirmed bookings can be marked attended or no-show." },
      { status: 409 }
    );
  }
  if (minutesUntilUk(booking.booking_date as string, booking.booking_time as string) > 0) {
    return NextResponse.json(
      { error: "not_started", message: "You can record attendance once the appointment has started." },
      { status: 409 }
    );
  }

  const { error } = await supabaseAdmin
    .from("bookings")
    .update({
      attendance: value,
      attendance_marked_at: value ? new Date().toISOString() : null,
    })
    .eq("id", id);
  if (error) {
    const missing = error.code === "PGRST204" || error.code === "42703";
    return NextResponse.json(
      {
        error: missing ? "migration_required" : "save_failed",
        message: missing
          ? "Attendance needs the latest database update (migration 20261118_attendance)."
          : "Could not save. Please try again.",
      },
      { status: missing ? 409 : 500 }
    );
  }
  return NextResponse.json({ ok: true, attendance: value });
}
