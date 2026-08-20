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
