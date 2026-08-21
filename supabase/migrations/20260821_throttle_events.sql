-- ============================================================================
-- Sliding-window IP throttle — new `throttle_events` table.
--
-- Run this in the Supabase dashboard -> SQL Editor BEFORE deploying the branch.
-- Idempotent; safe to re-run. Keep supabase/schema.sql in lockstep.
--
-- WHY: the app has no rate limiting of any kind today, and the voucher-code
-- checkout endpoint (a later PR) is a public, unauthenticated surface onto the
-- voucher system — without a throttle it is a brute-force oracle for free
-- treatments. This table is the storage behind lib/rate-limit.ts.
--
-- WHY A TABLE: the Worker has no KV, Durable Object or D1 binding (see
-- wrangler.jsonc), and module-scope state is useless for this — Worker isolates
-- are per-PoP and ephemeral, so an in-memory counter resets constantly and is
-- never shared between isolates. Supabase via `supabaseAdmin` is the only
-- durable primitive available, and matches CLAUDE.md rule 6 (service role is
-- the only DB path).
--
-- PRIVACY: `ip_hash` is a peppered SHA-256 of the caller's IP, never the raw
-- address. A plain SHA-256 of the IPv4 space is rainbow-table reversible, so
-- lib/rate-limit.ts prefixes a constant pepper before hashing. Nothing here
-- identifies a person, and rows are pruned within ~24h by the helper itself.
--
-- SECURITY: like every other table here, RLS is ENABLED with ZERO policies, so
-- the anon / authenticated PostgREST roles are denied by default. All reads and
-- writes go through the service-role client (lib/supabase.ts `supabaseAdmin`),
-- which bypasses RLS.
--
-- HOUSEKEEPING: no cron. lib/rate-limit.ts opportunistically deletes rows older
-- than 24h for the scope it just touched, so the table stays bounded by daily
-- traffic without adding a scheduled job.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.throttle_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope      text NOT NULL,          -- e.g. 'voucher-check', 'voucher-book'
  ip_hash    text NOT NULL,          -- peppered SHA-256, never the raw IP
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Covers the counting query: WHERE scope = ? AND ip_hash = ? AND created_at >= ?
-- and the prune: WHERE scope = ? AND created_at < ?
CREATE INDEX IF NOT EXISTS throttle_events_lookup_idx
  ON public.throttle_events (scope, ip_hash, created_at);

ALTER TABLE public.throttle_events ENABLE ROW LEVEL SECURITY;
-- No policies on purpose -> deny-by-default; the service role bypasses RLS.
