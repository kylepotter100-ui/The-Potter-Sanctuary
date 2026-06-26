// Wipe ALL voucher rows for the scoped test email (CLAUDE.md test-data rule:
// only ever delete by the test email kylepotter1@hotmail.co.uk).
//
// Usage:  npm run wipe:vouchers
// Needs:  NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the env.
//
// The shared Supabase is the LIVE database — this script is intentionally narrow:
// it deletes from the `vouchers` table only, and only where purchaser_email
// equals the test address (case-insensitive, no wildcards).

import { createClient } from "@supabase/supabase-js";

const TEST_EMAIL = "kylepotter1@hotmail.co.uk";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in the environment."
  );
  process.exit(1);
}

const admin = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data, error } = await admin
  .from("vouchers")
  .delete()
  .ilike("purchaser_email", TEST_EMAIL) // exact, case-insensitive (no % wildcards)
  .select("id");

if (error) {
  console.error("Wipe failed:", error.message);
  process.exit(1);
}

console.log(`Deleted ${data?.length ?? 0} voucher(s) for ${TEST_EMAIL}.`);
