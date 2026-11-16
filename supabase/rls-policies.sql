-- Row Level Security for The Potter Sanctuary. Idempotent — safe to re-run.
--
-- POLICY: DENY BY DEFAULT, ZERO CLIENT POLICIES (CLAUDE.md rule 6).
-- Every table has RLS enabled and NO policies, and the anon/authenticated roles
-- hold no table privileges. All data access goes through API routes and server
-- components using the service role, which bypasses RLS. The browser Supabase
-- client is for auth only.
--
-- This file previously CREATED customer-facing policies ("Customers can insert
-- own profile" etc.). Those allowed a signed-in customer to pre-claim another
-- person's email and read their health questionnaire — see
-- supabase/migrations/20261116_rls_deny_by_default.sql. Do NOT add a policy
-- here without also adding the API-level checks it bypasses.

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

DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END$$;

REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
