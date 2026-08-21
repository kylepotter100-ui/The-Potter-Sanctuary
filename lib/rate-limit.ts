import type { SupabaseClient } from "@supabase/supabase-js";

// Sliding-window per-IP throttle for public, unauthenticated endpoints.
// The window is a lookback from now (not a calendar bucket), so a caller
// can't get a double budget by straddling a bucket boundary.
//
// Runtime-safe for workerd (CLAUDE.md rule 1): uses Web Crypto
// `crypto.subtle` — available in the Worker, Node 18+ and the browser — NOT
// `node:crypto`. `node:crypto`'s createHash/timingSafeEqual threw at runtime
// and 500'd the admin login for days; this is the first `crypto.subtle` use in
// the repo, so keep it that way.
//
// STORAGE: the `throttle_events` table (supabase/migrations/20260821_*). The
// Worker has no KV, Durable Object or D1 binding, and isolates are per-PoP and
// ephemeral — a module-scope Map would reset constantly and never be shared,
// so it would be worse than useless as a limiter. Supabase via `supabaseAdmin`
// is the only durable primitive, matching CLAUDE.md rule 6.
//
// This module is generic on purpose. Nothing calls it yet; the intended
// consumers are the public voucher-code endpoints, and after that the admin
// login (`app/api/admin/login/route.ts`, currently an unbounded password
// oracle) and `/api/customer/check` (an email-enumeration oracle). Both are
// unthrottled today.

// Constant pepper. An unsalted SHA-256 of the IPv4 space is small enough to
// rainbow-table, so a leaked dump of this table would be trivially reversible
// back to real addresses. The pepper isn't a secret — it's hygiene, and it
// means the stored hashes are useless outside this application.
const IP_PEPPER = "tps-throttle|";

/**
 * Peppered SHA-256 of a client IP, hex-encoded. Never store or log the raw IP.
 * Async because `crypto.subtle.digest` is async (unlike `getRandomValues`).
 */
export async function hashIp(ip: string): Promise<string> {
  const bytes = new TextEncoder().encode(IP_PEPPER + ip);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * The caller's IP as Cloudflare sees it. `CF-Connecting-IP` is set by the edge
 * and cannot be spoofed by the client (unlike X-Forwarded-For). Falls back to
 * a constant when absent — that groups all non-Cloudflare traffic into one
 * bucket, which is the safe direction: local dev and worker-to-worker calls
 * share a budget rather than escaping the limit entirely.
 */
export function clientIpFrom(req: Request): string {
  return req.headers.get("cf-connecting-ip") ?? "unknown";
}

/**
 * Pure boundary rule, extracted so it can be unit-tested without a database.
 * `count` includes the caller's own just-inserted event, so the Nth request
 * inside the window is the last one allowed.
 */
export function isWithinLimit(count: number, limit: number): boolean {
  return count <= limit;
}

export type RateLimitOptions = {
  limit: number;
  windowMinutes: number;
};

export type RateLimitResult = {
  allowed: boolean;
  /** True when the limiter itself failed and we let the request through. */
  degraded: boolean;
};

// Rows older than this are swept on the next request touching the same scope.
// Comfortably longer than any window we use, so pruning can never delete an
// event that still counts.
const PRUNE_AFTER_HOURS = 24;

/**
 * Record this request and report whether the caller is still inside its budget.
 *
 * FAILS OPEN, LOUDLY. If Supabase is unreachable or the table is missing, the
 * request is allowed and the failure is logged with the greppable prefix
 * `[rate-limit] FAIL-OPEN`. The Worker has `observability.enabled`, so those
 * lines are searchable in the Cloudflare dashboard. Rationale: a database blip
 * must not take down booking or sign-in for real customers. The trade is that
 * an attacker who can break Supabase also removes the throttle — acceptable
 * here because that same outage takes the voucher lookup down with it, so
 * there is nothing left to brute-force.
 */
export async function checkRateLimit(
  admin: SupabaseClient,
  scope: string,
  ipHash: string,
  { limit, windowMinutes }: RateLimitOptions
): Promise<RateLimitResult> {
  const failOpen = (step: string, error: unknown): RateLimitResult => {
    console.error(
      "[rate-limit] FAIL-OPEN — limiter degraded",
      JSON.stringify({ scope, step, error })
    );
    return { allowed: true, degraded: true };
  };

  try {
    // 1. Record this attempt first, so a request can never escape the count by
    //    failing between the read and the write.
    const { error: insertError } = await admin
      .from("throttle_events")
      .insert({ scope, ip_hash: ipHash });
    if (insertError) return failOpen("insert", insertError);

    // 2. Count attempts inside the window, including the one just inserted.
    //    NOTE for CLAUDE.md rule 3: these Date uses are deliberate and safe.
    //    They are elapsed-time arithmetic on absolute instants compared against
    //    a timestamptz column — not UK wall-clock parsing, which is what rule 3
    //    forbids. There is no booking date/time anywhere near this file.
    const windowStart = new Date(
      Date.now() - windowMinutes * 60_000
    ).toISOString();
    const { count, error: countError } = await admin
      .from("throttle_events")
      .select("id", { count: "exact", head: true })
      .eq("scope", scope)
      .eq("ip_hash", ipHash)
      .gte("created_at", windowStart);
    if (countError) return failOpen("count", countError);

    const allowed = isWithinLimit(count ?? 0, limit);

    // 3. Opportunistic housekeeping — keeps the table bounded without a cron.
    //    Never allowed to affect the verdict, so failures are logged and
    //    swallowed rather than flipping an over-limit caller to allowed.
    const pruneBefore = new Date(
      Date.now() - PRUNE_AFTER_HOURS * 3_600_000
    ).toISOString();
    const { error: pruneError } = await admin
      .from("throttle_events")
      .delete()
      .eq("scope", scope)
      .lt("created_at", pruneBefore);
    if (pruneError) {
      console.error(
        "[rate-limit] prune failed (verdict unaffected)",
        JSON.stringify({ scope, error: pruneError })
      );
    }

    return { allowed, degraded: false };
  } catch (err) {
    return failOpen("unexpected", String(err));
  }
}
