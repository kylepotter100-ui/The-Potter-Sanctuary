-- =============================================================================
-- RLS: deny-by-default on every public table (zero client-facing policies)
-- Apply in Supabase dashboard -> SQL Editor. Idempotent: safe to re-run.
-- =============================================================================
-- WHY: the live database still carried the customer-facing policies from
-- supabase/rls-policies.sql. "Customers can insert own profile" only checked
-- auth.uid() = user_id, so a signed-in customer could INSERT a customers row
-- with THEIR user_id and SOMEONE ELSE's email. When that person later booked,
-- the booking upsert (on email) reused the row, and the SELECT policies then
-- let the attacker read the victim's contact details and health questionnaire
-- straight from PostgREST with the public anon key. Reproduced against a copy
-- of the live policies before this migration; blocked after it.
--
-- The app never needs these policies: every read/write goes through API
-- routes and server components using the service role, which bypasses RLS
-- (CLAUDE.md rule 6). The browser Supabase client is used for auth only.

-- 1. Drop every policy that exists today (names taken from pg_policies, 16 Nov 2026).
DROP POLICY IF EXISTS "Anyone can view availability"           ON public.availability;
DROP POLICY IF EXISTS "Anyone can view blocked dates"          ON public.blocked_dates;
DROP POLICY IF EXISTS "Anyone can view slot overrides"         ON public.slot_overrides;
DROP POLICY IF EXISTS "Customers can view own bookings"        ON public.bookings;
DROP POLICY IF EXISTS "Anyone can insert bookings"             ON public.bookings;
DROP POLICY IF EXISTS "Customers can insert own consultations" ON public.consultation_responses;
DROP POLICY IF EXISTS "Customers can update own consultations" ON public.consultation_responses;
DROP POLICY IF EXISTS "Customers can view own consultations"   ON public.consultation_responses;
DROP POLICY IF EXISTS "Customers can insert own profile"       ON public.customers;
DROP POLICY IF EXISTS "Customers can update own profile"       ON public.customers;
DROP POLICY IF EXISTS "Customers can view own profile"         ON public.customers;

-- 2. RLS on for every table in public (covers any table added later by hand).
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END$$;

-- 3. Belt and braces: the client roles get no table privileges at all, so even
--    a policy re-created by mistake grants nothing. service_role is untouched.
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

-- 4. Verify (should return zero rows):
--    SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public';
--
-- 5. Check whether the hole was ever used (should return zero rows). Any row is
--    a customer record whose linked login belongs to a DIFFERENT email address —
--    send it to the developer before changing anything:
--    SELECT c.id, c.email AS customer_email, u.email AS login_email, c.created_at
--    FROM public.customers c JOIN auth.users u ON u.id = c.user_id
--    WHERE lower(u.email) <> lower(c.email);
