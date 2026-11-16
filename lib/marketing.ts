import type { SupabaseClient } from "@supabase/supabase-js";
import { siteConfig } from "@/lib/site";

// Marketing consent (UK PECR/GDPR): opt-in only, never pre-ticked, and every
// marketing email carries a one-click unsubscribe (RFC 8058 headers + link).

/** Weeks after a visit before the "time for your next treatment" nudge. */
export const REBOOK_AFTER_DAYS = 35;
/** Only nudge within this window after REBOOK_AFTER_DAYS (cron runs hourly). */
export const REBOOK_WINDOW_DAYS = 7;

export function unsubscribeUrl(token: string): string {
  return `${siteConfig.url}/unsubscribe?t=${encodeURIComponent(token)}`;
}

/** RFC 8058 one-click unsubscribe headers (Gmail/Yahoo bulk-sender rules). */
export function unsubscribeHeaders(token: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${siteConfig.url}/api/unsubscribe?t=${encodeURIComponent(token)}>, <mailto:${siteConfig.contact.email}?subject=unsubscribe>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

/**
 * Record a client's opt-in. Done AFTER the booking is saved and failures are
 * swallowed, so marketing can never break a booking (or before the migration
 * adds the columns). Only applied when the caller's identity is trusted or the
 * customer record was just created — an anonymous request can't subscribe
 * someone else's address.
 */
export async function recordMarketingOptIn(
  admin: SupabaseClient,
  customerId: string,
  allowed: boolean
): Promise<void> {
  if (!allowed) return;
  const { error } = await admin
    .from("customers")
    .update({ marketing_opt_in: true, marketing_opt_in_at: new Date().toISOString() })
    .eq("id", customerId);
  if (error) console.error("[marketing] opt-in not recorded", error.code, error.message);
}

export function isUuid(s: unknown): s is string {
  return typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}
