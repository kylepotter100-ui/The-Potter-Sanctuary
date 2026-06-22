import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createBooking } from "@/lib/booking-create";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_VALUE,
} from "@/lib/admin-session";

export const dynamic = "force-dynamic";

async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  return store.get(ADMIN_SESSION_COOKIE)?.value === ADMIN_SESSION_VALUE;
}

type Payload = {
  date: string;
  time: string;
  serviceId: string;
  gender: string | null;
  fname: string;
  lname: string;
  phone: string;
  email: string;
  message?: string;
  detailsUnchanged?: boolean | null;
  // "Book anytime" — bypass website availability rules (any day/time), clashes
  // still blocked.
  bookAnytime?: boolean;
};

export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  }

  let payload: Payload;
  try {
    payload = (await req.json()) as Payload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const required = [
    payload?.date,
    payload?.time,
    payload?.serviceId,
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

  // Manual booking: confirmed immediately, client gets the standard
  // BookingConfirmation email, NO owner notification (the owner made it).
  const result = await createBooking(
    {
      date: payload.date,
      time: payload.time,
      serviceId: payload.serviceId,
      gender: payload.gender ?? null,
      fname: payload.fname,
      lname: payload.lname,
      phone: payload.phone,
      email: payload.email,
      message: payload.message,
      detailsUnchanged: payload.detailsUnchanged ?? null,
    },
    {
      status: "confirmed",
      adminMode: payload.bookAnytime === true,
      sendOwnerNotification: false,
    }
  );

  if (result.ok) {
    return NextResponse.json({ ok: true, id: result.id });
  }
  return NextResponse.json(
    result.message ? { error: result.error, message: result.message } : { error: result.error },
    { status: result.status }
  );
}
