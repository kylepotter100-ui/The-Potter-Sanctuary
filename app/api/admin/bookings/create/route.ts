import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { createBooking } from "@/lib/booking-create";
import { bookingFieldsProblem } from "@/lib/booking-validate";

export const dynamic = "force-dynamic";


type Payload = {
  date: string;
  time: string;
  serviceId: string;
  gender: string | null;
  fname: string;
  lname: string;
  phone: string;
  email?: string | null;
  message?: string;
  // How this client wants to be contacted. Anything but "email" means no
  // automatic emails, and the email address becomes optional.
  contactPreference?: "email" | "phone" | "none";
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
  ];
  const pref =
    payload?.contactPreference === "phone" || payload?.contactPreference === "none"
      ? payload.contactPreference
      : "email";
  const email = typeof payload?.email === "string" ? payload.email.trim() : "";
  if (
    required.some((v) => !v) ||
    (pref === "email" && !email) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(payload.date) ||
    !/^\d{2}:\d{2}(:\d{2})?$/.test(payload.time)
  ) {
    return NextResponse.json(
      { error: "Missing or invalid required fields" },
      { status: 400 }
    );
  }
  const fieldProblem = bookingFieldsProblem(
    { ...payload, email },
    { emailOptional: pref !== "email" }
  );
  if (fieldProblem) {
    return NextResponse.json(
      { error: "invalid_fields", message: fieldProblem },
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
      email: email || null,
      message: payload.message,
      detailsUnchanged: payload.detailsUnchanged ?? null,
    },
    {
      status: "confirmed",
      adminMode: payload.bookAnytime === true,
      sendOwnerNotification: false,
      // The owner is creating this booking — she vouches for the details.
      trustedIdentity: true,
      contactPreference: pref,
      suppressComms: pref !== "email",
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
