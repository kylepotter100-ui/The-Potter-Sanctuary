// Phone-number normalization — the ONE home for turning a typed phone string
// into a canonical comparison key. Used as a SECOND exact-match key for customer
// identity (a correct phone rescues a typo'd email at booking time).
//
// This is DETERMINISTIC, not fuzzy: it only strips formatting and collapses the
// UK country code (+44 / 0044) to the trunk "0" so the three ways of writing the
// same UK number compare equal. It never tries to guess that two *different*
// numbers are "close enough".
//
// IMPORTANT: this algorithm is mirrored by the `phone_normalized` STORED
// generated column on public.customers (see supabase/schema.sql). The DB
// computes the stored value; this function computes the lookup value. Both MUST
// follow the same steps or matches will silently miss — tests/phone.test.ts
// guards this side.
export function normalizePhone(raw: string | null | undefined): string {
  // 1) Digits only — drops spaces, hyphens, parens, dots and any leading "+".
  const d = (raw ?? "").replace(/[^0-9]/g, "");

  // 2) UK country code → trunk "0" (the only transformation).
  if (d.startsWith("0044")) return "0" + d.slice(4);
  if (d.startsWith("44") && d.length === 12) return "0" + d.slice(2);

  // 3) Everything else (already-national UK, or non-UK) stays digits-only.
  return d;
}
