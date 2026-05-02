-- Run this in Supabase dashboard → SQL Editor after the main schema. Idempotent — safe to re-run.

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

-- Public bookings (allow inserts from booking form for non-authenticated users)
CREATE POLICY "Anyone can insert bookings"
ON public.bookings FOR INSERT
WITH CHECK (true);

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

-- Note: All admin operations and writes to availability/blocked_dates
-- happen via supabaseAdmin (service role) which bypasses RLS by design.
