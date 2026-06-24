-- Run this in the Supabase dashboard → SQL Editor. Idempotent; safe to re-run.
--
-- Security fix (Supabase advisor: rls_policy_always_true).
--
-- The `bookings` table carried a legacy RLS policy
--   "Anyone can insert bookings"  FOR INSERT  WITH CHECK (true)
-- (from an earlier supabase/rls-policies.sql). Enabling RLS during the June
-- booking-audit hardening did NOT remove it, so it stayed live: anyone holding
-- the PUBLIC anon key could POST to /rest/v1/bookings and insert arbitrary rows
-- directly, bypassing all the server-side validation in lib/booking-create.ts
-- (treatment price/name integrity, customer reconciliation, slot rules).
--
-- Real bookings are inserted by /api/booking via the service-role client, which
-- bypasses RLS — so dropping this policy does NOT affect the public booking
-- form. It simply restores the intended deny-by-default on bookings.

DROP POLICY IF EXISTS "Anyone can insert bookings" ON public.bookings;
