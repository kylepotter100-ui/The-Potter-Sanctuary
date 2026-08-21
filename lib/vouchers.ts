// Gift-voucher code generation + validation.
//
// Runtime-safe for workerd (CLAUDE.md rule 1): uses Web Crypto
// `crypto.getRandomValues` — available in the Worker, Node and the browser —
// NOT `node:crypto`. Pure functions only, unit-tested in tests/vouchers.test.ts.

// 32-char unambiguous alphabet: excludes I, O, 0 and 1 so a hand-typed or
// read-aloud code can't be confused. 256 % 32 === 0, so `byte % 32` is unbiased.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function block(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  let s = "";
  for (let i = 0; i < 4; i++) s += ALPHABET[bytes[i] % ALPHABET.length];
  return s;
}

// "PS-XXXX-XXXX" — the unique, single-use code printed on every voucher.
export function generateVoucherCode(): string {
  return `PS-${block()}-${block()}`;
}

// Validates the canonical format over the unambiguous alphabet
// (A–H, J–N, P–Z, 2–9 — i.e. no I/O/0/1).
export function isValidVoucherCodeFormat(code: string): boolean {
  return /^PS-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/.test(code);
}

// ---------------------------------------------------------------------------
// Complimentary vouchers
//
// The owner can give a treatment away free of charge. Rather than carry a
// separate column, a complimentary voucher is simply stored with `value = 0`:
// every treatment in lib/services.ts is priced above zero, so a zero value is
// unambiguous. Keeping the rule in one place stops the five display sites
// (create form, success e-card, issued list, redeem modal, detail page) and the
// delivery email from drifting apart.

export function isComplimentaryVoucher(value: number): boolean {
  return value === 0;
}

// The amount as shown to a human. Complimentary vouchers read "Complimentary"
// rather than "£0", which on a gift e-card looks like a pricing error.
export function voucherValueLabel(value: number): string {
  return isComplimentaryVoucher(value) ? "Complimentary" : `£${value}`;
}

// ---------------------------------------------------------------------------
// Redeeming a voucher at booking time
//
// Both the public check endpoint (app/api/voucher/check) and the booking route
// (app/api/booking) run the SAME two functions below, so what the customer is
// told when they press "Apply" can never disagree with what happens when they
// actually submit. Keep them pure — they are the only voucher rules with test
// coverage.

/**
 * Tidy up whatever the customer typed into the canonical `PS-XXXX-XXXX` shape.
 * Accepts lowercase, stray spaces, missing or extra dashes — people copy these
 * out of an email or read them off a printout. Anything that still doesn't fit
 * the format is returned uppercased and left for `isValidVoucherCodeFormat` to
 * reject; this function never decides validity.
 */
export function normalizeVoucherCode(raw: string): string {
  const bare = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const match = /^PS([A-HJ-NP-Z2-9]{4})([A-HJ-NP-Z2-9]{4})$/.exec(bare);
  return match ? `PS-${match[1]}-${match[2]}` : raw.trim().toUpperCase();
}

/** Why a voucher can't be used for this booking, or null if it can. */
export type VoucherIssue = "not_active" | "expired" | "treatment_mismatch";

export type VoucherForBooking = {
  status: string;
  expires_at: string | null;
  treatment_id: string;
};

/**
 * Decide whether a voucher may fund a booking of `treatmentId` today.
 *
 * PRECEDENCE IS DELIBERATE: `not_active` is checked first so an already-used
 * code reveals nothing further about itself — no expiry date, no treatment
 * name. Only a genuinely usable code gets a specific explanation.
 *
 * Expiry is INCLUSIVE of `expires_at` ("Valid until 3 May" means the 3rd still
 * works), and a null `expires_at` never expires. `todayIso` is passed in rather
 * than read here so the caller supplies UK today (lib/uk-time `ukTodayIso`) —
 * the Worker clock is UTC, and CLAUDE.md rule 3 forbids deriving a UK date from
 * it. Keeping it a parameter also keeps this function pure and testable.
 */
export function voucherBookingIssue(
  voucher: VoucherForBooking,
  treatmentId: string,
  todayIso: string
): VoucherIssue | null {
  if (voucher.status !== "active") return "not_active";
  if (voucher.expires_at && voucher.expires_at < todayIso) return "expired";
  if (voucher.treatment_id !== treatmentId) return "treatment_mismatch";
  return null;
}
