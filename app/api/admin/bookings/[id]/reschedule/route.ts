import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { rescheduleBooking } from "@/lib/booking-reschedule";

export const dynamic = "force-dynamic";


type Body = { date?: string; time?: string };

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  }
  const { id } = await params;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const date = body.date ?? "";
  const time = body.time ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}(:\d{2})?$/.test(time)) {
    return NextResponse.json(
      { error: "Missing or invalid new date/time" },
      { status: 400 }
    );
  }

  // Owner reschedule: "book anytime" slot rules, no 15-min cut-off, no ownership
  // filter. Moves the booking and emails the client the reschedule confirmation.
  const result = await rescheduleBooking({
    bookingId: id,
    newDate: date,
    newTime: time,
    by: "owner",
  });

  if (result.ok) {
    return NextResponse.json({ ok: true, id: result.id });
  }
  return NextResponse.json(
    result.message ? { error: result.error, message: result.message } : { error: result.error },
    { status: result.status }
  );
}
