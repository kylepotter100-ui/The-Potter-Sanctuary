import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizePhone } from "@/lib/phone";
import { ukTodayIso } from "@/lib/uk-time";

// Whether a public web booking is confirmed instantly or waits for the owner.
// Set with the AUTO_CONFIRM Worker variable (runtime, so it can be changed in
// the Cloudflare dashboard without a rebuild):
//   off        (default) every web booking is "pending" until the owner confirms
//   returning  confirmed instantly for returning clients (see below)
//   all        every web booking is confirmed instantly
export type AutoConfirmMode = "off" | "returning" | "all";

export function autoConfirmMode(): AutoConfirmMode {
  const v = (process.env.AUTO_CONFIRM ?? "").trim().toLowerCase();
  return v === "returning" || v === "all" ? v : "off";
}

/**
 * A returning client = an existing customer with at least one past confirmed
 * visit that wasn't a no-show. Identity must be proven: either signed in with
 * this email (trusted) or the phone number also matches the record — knowing
 * someone's email alone isn't enough to skip the owner's check.
 */
export async function isReturningClient(
  admin: SupabaseClient,
  email: string,
  phone: string,
  trusted: boolean
): Promise<boolean> {
  const { data: customer } = await admin
    .from("customers")
    .select("*")
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();
  if (!customer) return false;
  if (!trusted) {
    const onFile = (customer as { phone_normalized?: string | null }).phone_normalized ?? "";
    if (!onFile || onFile !== normalizePhone(phone)) return false;
  }
  const { data: past } = await admin
    .from("bookings")
    .select("*")
    .eq("customer_id", (customer as { id: string }).id)
    .eq("status", "confirmed")
    .lt("booking_date", ukTodayIso())
    .limit(20);
  return (past ?? []).some(
    (b) => (b as { attendance?: string | null }).attendance !== "no_show"
  );
}
