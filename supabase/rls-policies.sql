-- Run this in Supabase dashboard → SQL Editor after the main schema. Idempotent — safe to re-run.
--
-- IMPORTANT: re-run this file after pulling the Phase 4.5 changes. The
-- ENABLE ROW LEVEL SECURITY statements below were missing from earlier
-- versions, which meant the customer / consultation policies were inert
-- on tables created via raw SQL. Re-running this in the Supabase SQL
-- Editor activates them on the live database.

-- Enable RLS on every table that holds personal or health data so the
-- CREATE POLICY statements below are actually enforced.
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultation_responses ENABLE ROW LEVEL SECURITY;
-- daily_summaries_sent is admin/server-only — no policies, but RLS on by
-- default closes the table to anon reads.
ALTER TABLE public.daily_summaries_sent ENABLE ROW LEVEL SECURITY;

-- Customers table policies
DROP POLICY IF EXISTS "Customers can view own profile" ON public.customers;
DROP POLICY IF EXISTS "Customers can update own profile" ON public.customers;
DROP POLICY IF EXISTS "Customers can insert own profile" ON public.customers;

CREATE POLICY "Customers can view own profile"
ON public.customers FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Customers can update own profile"
ON public.customers FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Customers can insert own profile"
ON public.customers FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Consultation responses policies
DROP POLICY IF EXISTS "Customers can view own consultations" ON public.consultation_responses;
DROP POLICY IF EXISTS "Customers can insert own consultations" ON public.consultation_responses;
DROP POLICY IF EXISTS "Customers can update own consultations" ON public.consultation_responses;

CREATE POLICY "Customers can view own consultations"
ON public.consultation_responses FOR SELECT
USING (
  customer_id IN (
    SELECT id FROM public.customers WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Customers can insert own consultations"
ON public.consultation_responses FOR INSERT
WITH CHECK (
  customer_id IN (
    SELECT id FROM public.customers WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Customers can update own consultations"
ON public.consultation_responses FOR UPDATE
USING (
  customer_id IN (
    SELECT id FROM public.customers WHERE user_id = auth.uid()
  )
);

-- Bookings policies
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Customers can view own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Anyone can insert bookings" ON public.bookings;

CREATE POLICY "Customers can view own bookings"
ON public.bookings FOR SELECT
USING (
  customer_id IN (
    SELECT id FROM public.customers WHERE user_id = auth.uid()
  )
);

-- NO anon INSERT policy on bookings. Bookings are created server-side by
-- /api/booking via supabaseAdmin (service role), which bypasses RLS — so the
-- public form needs no anon insert. The old `"Anyone can insert bookings" WITH
-- CHECK (true)` let anyone with the public anon key write arbitrary rows
-- straight to PostgREST, bypassing all server-side validation; it is dropped
-- above (and in supabase/schema.sql) and deliberately not recreated.
-- (Supabase advisor: rls_policy_always_true.)

-- Availability table — public read only (no inserts/updates from client)
ALTER TABLE public.availability ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view availability" ON public.availability;
CREATE POLICY "Anyone can view availability"
ON public.availability FOR SELECT
USING (true);

-- Blocked dates — public read only
ALTER TABLE public.blocked_dates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view blocked dates" ON public.blocked_dates;
CREATE POLICY "Anyone can view blocked dates"
ON public.blocked_dates FOR SELECT
USING (true);

-- Slot overrides (Phase 4) — per-date slot tweaks. Public read so the
-- booking calendar can render them. Writes happen via supabaseAdmin.
ALTER TABLE public.slot_overrides ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view slot overrides" ON public.slot_overrides;
CREATE POLICY "Anyone can view slot overrides"
ON public.slot_overrides FOR SELECT
USING (true);

-- Note: All admin operations and writes to availability/blocked_dates/slot_overrides
-- happen via supabaseAdmin (service role) which bypasses RLS by design.
