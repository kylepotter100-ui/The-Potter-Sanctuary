import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import {
  isValidVoucherCodeFormat,
  normalizeVoucherCode,
  voucherBookingIssue,
} from "@/lib/vouchers";
import { checkRateLimit, clientIpFrom, hashIp } from "@/lib/rate-limit";
import { ukTodayIso } from "@/lib/uk-time";
import { formatLongDate } from "@/lib/format";

export const dynamic = "force-dynamic";

// Public, UNAUTHENTICATED lookup used by the booking form's "Apply" button to
// tell a customer whether their gift-voucher code covers the treatment they're
// booking. This is the only public surface onto the voucher system, so:
//
//  - IT IS RATE LIMITED. Codes are PS-XXXX-XXXX over a 32-char alphabet
//    (~1.1e12 combinations). Without a throttle this endpoint is an oracle for
//    free treatments — guess codes until one comes back valid. 10 attempts per
//    10 minutes per IP makes that take longer than the heat death of the
//    business. See lib/rate-limit.ts.
//  - IT DOESN'T ENUMERATE. "No such code" and "already redeemed" return the
//    SAME generic message and the same 200 shape, so an attacker can't use the
//    response to confirm a code exists. Expiry and treatment-mismatch DO get
//    specific messages, but only for a fully valid code the caller already
//    holds — that leaks nothing they don't know, and a real customer with a
//    genuine problem needs to be told what it is.
//  - IT RETURNS THE MINIMUM. Only what the UI renders: whether it's usable,
//    which treatment it covers and its value. Never the purchaser, the
//    recipient, the gift message or the expiry of someone else's voucher.
//
// POST rather than GET so codes never land in URLs, server logs or Referer
// headers. Never log the code itself.

const GENERIC_REJECTION =
  "That code doesn't look right, or it's already been used. Please check your voucher, or get in touch and we'll help.";

const RATE_LIMIT = { limit: 10, windowMinutes: 10 };

type Body = { code?: string; treatmentId?: string };

const NO_STORE = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
} as const;

function invalid(message: string) {
  // Always 200 with { valid: false } — the status code must not become the
  // oracle that the message body deliberately isn't.
  return NextResponse.json(
    { valid: false, message },
    { status: 200, headers: NO_STORE }
  );
}

export async function POST(req: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { valid: false, message: "Voucher checking is unavailable right now." },
      { status: 503, headers: NO_STORE }
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const treatmentId = (body.treatmentId ?? "").trim();
  const code = normalizeVoucherCode(body.code ?? "");

  // Reject malformed codes statically — no database round-trip, and no throttle
  // row either. The format regex ships in the client bundle anyway, so counting
  // these would only burn budget on typos while a real attacker sends
  // well-formed guesses regardless. Same generic message, so a typo and a wrong
  // guess are indistinguishable.
  if (!isValidVoucherCodeFormat(code) || !treatmentId) {
    return invalid(GENERIC_REJECTION);
  }

  const { allowed } = await checkRateLimit(
    supabaseAdmin,
    "voucher-check",
    await hashIp(clientIpFrom(req)),
    RATE_LIMIT
  );
  if (!allowed) {
    return NextResponse.json(
      {
        valid: false,
        error: "rate_limited",
        message:
          "Too many attempts. Please wait a few minutes and try again, or get in touch.",
      },
      { status: 429, headers: NO_STORE }
    );
  }

  const { data: voucher, error } = await supabaseAdmin
    .from("vouchers")
    .select("id, code, treatment_id, treatment_name, value, status, expires_at")
    .eq("code", code)
    .maybeSingle();

  if (error) {
    console.error("[voucher check] lookup failed", JSON.stringify(error));
    return NextResponse.json(
      { valid: false, message: "Couldn't check that code just now." },
      { status: 500, headers: NO_STORE }
    );
  }

  // A missing row is treated exactly like an unusable one — same branch, same
  // message. This is the anti-enumeration guarantee.
  if (!voucher) return invalid(GENERIC_REJECTION);

  const issue = voucherBookingIssue(
    {
      status: voucher.status as string,
      expires_at: voucher.expires_at as string | null,
      treatment_id: voucher.treatment_id as string,
    },
    treatmentId,
    ukTodayIso()
  );

  if (issue === "not_active") return invalid(GENERIC_REJECTION);
  if (issue === "expired") {
    return invalid(
      `This voucher expired on ${formatLongDate(
        voucher.expires_at as string
      )}. Please get in touch — we may still be able to help.`
    );
  }
  if (issue === "treatment_mismatch") {
    return invalid(
      `This voucher is for ${voucher.treatment_name}. Please select that treatment, or get in touch.`
    );
  }

  return NextResponse.json(
    {
      valid: true,
      treatmentId: voucher.treatment_id,
      treatmentName: voucher.treatment_name,
      value: voucher.value,
    },
    { status: 200, headers: NO_STORE }
  );
}
