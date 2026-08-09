import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { changeBookingTreatment } from "@/lib/booking-amend";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_VALUE,
} from "@/lib/admin-session";

export const dynamic = "force-dynamic";

async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  return store.get(ADMIN_SESSION_COOKIE)?.value === ADMIN_SESSION_VALUE;
}

type Body = { treatmentId?: string; date?: string; time?: string };

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

  const treatmentId = (body.treatmentId ?? "").trim();
  if (!treatmentId) {
    return NextResponse.json({ error: "Missing treatment" }, { status: 400 });
  }

  // date/time are optional — omitted means "keep the current slot". When one is
  // supplied both must be, and both must be well-formed.
  const date = body.date;
  const time = body.time;
  if (date !== undefined || time !== undefined) {
    if (
      !date ||
      !time ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !/^\d{2}:\d{2}(:\d{2})?$/.test(time)
    ) {
      return NextResponse.json(
        { error: "Invalid new date/time" },
        { status: 400 }
      );
    }
  }

  // Owner amendment: treatment (and optionally the slot) change together in one
  // atomic update; the client and the owner are both emailed.
  const result = await changeBookingTreatment({
    bookingId: id,
    newTreatmentId: treatmentId,
    newDate: date,
    newTime: time,
  });

  if (result.ok) {
    return NextResponse.json({ ok: true, id: result.id });
  }
  return NextResponse.json(
    result.message
      ? { error: result.error, message: result.message }
      : { error: result.error },
    { status: result.status }
  );
}
