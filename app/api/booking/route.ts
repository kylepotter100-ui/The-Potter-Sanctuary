import { NextResponse } from "next/server";
import { createBooking } from "@/lib/booking-create";
import { supabaseAdmin } from "@/lib/supabase";
import {
  isValidVoucherCodeFormat,
  normalizeVoucherCode,
  voucherBookingIssue,
} from "@/lib/vouchers";
import { revertVoucherRedemption } from "@/lib/voucher-revert";
import { checkRateLimit, clientIpFrom, hashIp } from "@/lib/rate-limit";
import { ukTodayIso } from "@/lib/uk-time";
import { bookingFieldsProblem } from "@/lib/booking-validate";
import { verifyTurnstile } from "@/lib/turnstile";
import { getCurrentUser } from "@/lib/supabase-server";
import { autoConfirmMode, isReturningClient } from "@/lib/auto-confirm";

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
  // Returning customers tell us whether their consultation details are still
  // current. true = no change (skip questionnaire CTA), false = needs new
  // questionnaire, null/undefined = first-time booking (always send CTA).
  detailsUnchanged?: boolean | null;
  // Optional gift-voucher code from step 3. Re-validated here from scratch —
  // the client having called /api/voucher/check proves nothing.
  voucherCode?: string;
  // Cloudflare Turnstile token from the widget on step 3.
  turnstileToken?: string | null;
};

// Booking budgets. A real customer books once or twice; these stop a script
// filling the diary with pending holds or using the studio as an email relay.
const BOOKING_PER_IP = { limit: 6, windowMinutes: 60 };
const BOOKING_PER_EMAIL = { limit: 4, windowMinutes: 24 * 60 };

function rateLimited() {
  return NextResponse.json(
    {
      error: "booking_rate_limited",
      message:
        "We've had several booking attempts from you in a short time. Please wait a little, or email hello@thepottersanctuary.co.uk and we'll book you in.",
    },
    { status: 429 }
  );
}

// Same generic wording as /api/voucher/check, for the same reason: "no such
// code" and "already used" must be indistinguishable.
const GENERIC_VOUCHER_REJECTION =
  "That code doesn't look right, or it's already been used. Please check your voucher, or get in touch and we'll help.";

function voucherInvalid(message: string) {
  return NextResponse.json(
    { error: "voucher_invalid", message },
    { status: 409 }
  );
}

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

  const fieldProblem = bookingFieldsProblem(payload);
  if (fieldProblem) {
    return NextResponse.json(
      { error: "invalid_fields", message: fieldProblem },
      { status: 400 }
    );
  }

  // ---- Abuse protection: rate limits, then the bot check ----------------
  const ip = clientIpFrom(req);
  if (supabaseAdmin) {
    const [byIp, byEmail] = await Promise.all([
      checkRateLimit(supabaseAdmin, "booking", await hashIp(ip), BOOKING_PER_IP),
      checkRateLimit(
        supabaseAdmin,
        "booking-email",
        await hashIp(`email:${payload.email.trim().toLowerCase()}`),
        BOOKING_PER_EMAIL
      ),
    ]);
    if (!byIp.allowed || !byEmail.allowed) return rateLimited();
  }

  const human = await verifyTurnstile(payload.turnstileToken, ip);
  if (!human.ok) {
    return NextResponse.json(
      {
        error: "verification_failed",
        message:
          "We couldn't confirm this booking came from a person. Please wait a moment and press the button again — or email hello@thepottersanctuary.co.uk.",
      },
      { status: 403 }
    );
  }

  // ---- Gift voucher: validate, then CLAIM, then book -------------------
  //
  // ORDER MATTERS. We flip the voucher to 'redeemed' BEFORE creating the
  // booking, and release it again if the booking fails. The alternative
  // (book first, claim after) fails far worse: a booking that failed to claim
  // would already exist as a live £0-marked row while the voucher stayed
  // active — double-spendable, and invisible in revenue. Claiming first means
  // the worst case is a voucher briefly stuck as 'redeemed' with no booking,
  // which is recoverable by hand and visible on the voucher detail page.
  //
  // The claim is a conditional update on status='active'. Two simultaneous
  // submissions of the same code therefore cannot both win: the loser matches
  // zero rows and gets the generic rejection.
  let claimedVoucher: { id: string; code: string } | null = null;

  if (payload.voucherCode?.trim()) {
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "Supabase is not configured on the server" },
        { status: 500 }
      );
    }

    const code = normalizeVoucherCode(payload.voucherCode);
    if (!isValidVoucherCodeFormat(code)) {
      return voucherInvalid(GENERIC_VOUCHER_REJECTION);
    }

    // Tighter budget than the check endpoint: submitting a booking is a much
    // heavier operation, and a genuine customer needs one or two attempts.
    const { allowed } = await checkRateLimit(
      supabaseAdmin,
      "voucher-book",
      await hashIp(clientIpFrom(req)),
      { limit: 5, windowMinutes: 10 }
    );
    if (!allowed) {
      return NextResponse.json(
        {
          error: "rate_limited",
          message:
            "Too many attempts. Please wait a few minutes and try again, or get in touch.",
        },
        { status: 429 }
      );
    }

    const { data: voucher, error: lookupError } = await supabaseAdmin
      .from("vouchers")
      .select("id, code, treatment_id, treatment_name, status, expires_at")
      .eq("code", code)
      .maybeSingle();

    if (lookupError) {
      console.error("[booking] voucher lookup failed", JSON.stringify(lookupError));
      return NextResponse.json(
        { error: "Could not check that voucher. Please try again." },
        { status: 500 }
      );
    }
    if (!voucher) return voucherInvalid(GENERIC_VOUCHER_REJECTION);

    const issue = voucherBookingIssue(
      {
        status: voucher.status as string,
        expires_at: voucher.expires_at as string | null,
        treatment_id: voucher.treatment_id as string,
      },
      payload.service.svc,
      ukTodayIso()
    );
    if (issue === "not_active") return voucherInvalid(GENERIC_VOUCHER_REJECTION);
    if (issue === "expired") {
      return voucherInvalid(
        "This voucher has expired. Please get in touch — we may still be able to help."
      );
    }
    if (issue === "treatment_mismatch") {
      return voucherInvalid(
        `This voucher is for ${voucher.treatment_name}. Please select that treatment, or get in touch.`
      );
    }

    // THE CLAIM. Conditional on still being active, so it is the single point
    // at which concurrent submissions are serialised.
    const { data: claimed, error: claimError } = await supabaseAdmin
      .from("vouchers")
      .update({ status: "redeemed", redeemed_at: new Date().toISOString() })
      .eq("id", voucher.id)
      .eq("status", "active")
      .select("id");

    if (claimError) {
      console.error("[booking] voucher claim failed", JSON.stringify(claimError));
      return NextResponse.json(
        { error: "Could not apply that voucher. Please try again." },
        { status: 500 }
      );
    }
    if (!claimed || claimed.length === 0) {
      // Lost the race to a simultaneous booking or an admin manual redeem.
      return voucherInvalid(GENERIC_VOUCHER_REJECTION);
    }

    claimedVoucher = { id: voucher.id as string, code: voucher.code as string };
  }

  // Public booking: stays "pending" (the owner confirms it), uses the website's
  // availability rules, and notifies the owner. All creation logic lives in the
  // shared helper so the public and admin manual paths can't drift.
  // A customer signed in with this exact email has proven who they are, so
  // their booking may refresh their record and carry their consultation
  // forward. Anyone else is linked to the customer but changes nothing.
  const user = await getCurrentUser();
  const trustedIdentity =
    !!user?.email &&
    user.email.toLowerCase() === payload.email.trim().toLowerCase();

  // Owner's AUTO_CONFIRM setting (default off = every web booking waits for
  // her confirmation, exactly as before).
  const mode = autoConfirmMode();
  const autoConfirm =
    mode === "all" ||
    (mode === "returning" &&
      !!supabaseAdmin &&
      (await isReturningClient(supabaseAdmin, payload.email, payload.phone, trustedIdentity)));

  let result;
  try {
    result = await createBooking(
      {
        date: payload.date,
        time: payload.time,
        serviceId: payload.service.svc,
        gender: payload.gender ?? null,
        fname: payload.fname,
        lname: payload.lname,
        phone: payload.phone,
        email: payload.email,
        message: payload.message,
        detailsUnchanged: payload.detailsUnchanged ?? null,
        voucher: claimedVoucher,
      },
      {
        status: autoConfirm ? "confirmed" : "pending",
        adminMode: false,
        sendOwnerNotification: true,
        trustedIdentity,
      }
    );
  } catch (err) {
    // createBooking is defensive and normally returns rather than throws, but
    // an unexpected throw must not silently burn the customer's voucher.
    console.error(
      "[booking] createBooking threw",
      JSON.stringify(err, Object.getOwnPropertyNames(err as object))
    );
    if (claimedVoucher && supabaseAdmin) {
      await revertVoucherRedemption(supabaseAdmin, claimedVoucher.id);
    }
    return NextResponse.json(
      { error: "Could not save your booking. Please try again." },
      { status: 500 }
    );
  }

  // RELEASE THE CLAIM if the booking didn't happen, so a failed attempt never
  // costs the customer their voucher. They can pick another slot and re-apply
  // the same code.
  //
  // The one exception is voucher_conflict: that means a LIVE booking already
  // links this voucher, so it is legitimately redeemed and releasing it would
  // create the active-voucher-on-a-live-booking state the unique index exists
  // to prevent. See the branch in lib/booking-create.ts.
  if (!result.ok && claimedVoucher && supabaseAdmin) {
    if (result.error !== "voucher_conflict") {
      await revertVoucherRedemption(supabaseAdmin, claimedVoucher.id);
    }
  }

  if (result.ok) {
    return NextResponse.json({
      ok: true,
      id: result.id,
      status: autoConfirm ? "confirmed" : "pending",
    });
  }
  // slot_unavailable / slot_taken carry a friendly message the calendar surfaces.
  return NextResponse.json(
    result.message ? { error: result.error, message: result.message } : { error: result.error },
    { status: result.status }
  );
}
