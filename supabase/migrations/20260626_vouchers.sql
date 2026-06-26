-- ============================================================================
-- Gift vouchers — new `vouchers` table.
--
-- Run this in the Supabase dashboard -> SQL Editor BEFORE deploying the voucher
-- code. Idempotent; safe to re-run. Keep supabase/schema.sql in lockstep.
--
-- WHY: the owner sells gift vouchers paid for OFFLINE (bank transfer / cash).
-- She creates one in admin, which emails the buyer a branded e-card carrying a
-- unique single-use `code`; the recipient brings it to their appointment and the
-- owner redeems it (status 'active' -> 'redeemed'). There is no online payment
-- and no customer-facing code entry.
--
-- SECURITY: like every other table here, RLS is ENABLED with ZERO policies, so
-- the anon / authenticated PostgREST roles are denied by default. All reads and
-- writes go through the service-role client (lib/supabase.ts `supabaseAdmin`),
-- which bypasses RLS. The UNIQUE index on `code` is the anti-double-redeem guard.
--
-- `value` is in POUNDS (an int), matching bookings.treatment_price and
-- lib/services `price` (50 => GBP 50). Do not store pence.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.vouchers (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                    text NOT NULL,
  treatment_id            text NOT NULL,
  treatment_name          text NOT NULL,
  value                   int  NOT NULL,
  purchaser_name          text NOT NULL,
  purchaser_email         text NOT NULL,
  recipient_name          text NOT NULL,
  gift_message            text,
  status                  text NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active','redeemed')),
  delivery_email_sent_at  timestamptz,
  redeemed_at             timestamptz,
  expires_at              date,
  created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS vouchers_code_key            ON public.vouchers (code);
CREATE INDEX        IF NOT EXISTS vouchers_purchaser_email_idx ON public.vouchers (purchaser_email);
CREATE INDEX        IF NOT EXISTS vouchers_status_idx          ON public.vouchers (status);

ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;
-- No policies on purpose -> deny-by-default; the service role bypasses RLS.
