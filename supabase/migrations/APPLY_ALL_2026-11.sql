-- =============================================================================
-- THE POTTER SANCTUARY — all database updates from the November 2026 PR series
-- (PRs #92, #93, #96, #97, #102, #105). Paste this whole file into
-- Supabase dashboard -> SQL Editor -> New query -> Run.
--
-- * Safe to run BEFORE or AFTER merging the PRs: every change is additive or a
--   policy removal, and the code works with the database either way.
-- * Safe to run more than once ("already exists, skipping" notices are normal).
-- * Runs as one transaction: if anything fails, nothing is changed.
-- * Two checks at the bottom — run them after and send the developer the
--   results if either returns rows.
-- =============================================================================
BEGIN;

-- ---------------------------------------------------------------------------
-- 20261116_rls_deny_by_default.sql
-- ---------------------------------------------------------------------------
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
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

-- 4. Verify (should return zero rows):
--
-- 5. Check whether the hole was ever used (should return zero rows). Any row is

-- ---------------------------------------------------------------------------
-- 20261116_reviews_one_per_booking.sql
-- ---------------------------------------------------------------------------
-- =============================================================================
-- One review per booking. Apply in Supabase dashboard -> SQL Editor.
-- Idempotent: safe to re-run.
-- =============================================================================
-- /api/reviews now refuses a second review for the same booking, but two
-- simultaneous submits could still both insert. This unique index is the
-- race-proof backstop (the route maps its 23505 to a friendly 409).
--
-- SAFE ON EXISTING DATA: nothing is deleted. If duplicates already exist the
-- index is NOT created and a notice lists the affected bookings so they can be
-- reviewed by hand first. Postgres treats NULL booking_id values as distinct,
-- so reviews not linked to a booking are unaffected.
DO $$
DECLARE dups text;
BEGIN
  SELECT string_agg(booking_id::text || ' (' || n || ' reviews)', ', ')
    INTO dups
    FROM (SELECT booking_id, count(*) n FROM public.reviews
          WHERE booking_id IS NOT NULL GROUP BY booking_id HAVING count(*) > 1) d;
  IF dups IS NOT NULL THEN
    RAISE NOTICE 'NOT CREATED: duplicate reviews exist for bookings: %. Send this list to the developer.', dups;
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS reviews_one_per_booking
      ON public.reviews (booking_id);
  END IF;
END$$;

-- ---------------------------------------------------------------------------
-- 20261117_contact_preferences.sql
-- ---------------------------------------------------------------------------
-- =============================================================================
-- Contact preferences + email-free manual bookings.
-- Apply in Supabase dashboard -> SQL Editor. Idempotent: safe to re-run.
-- Additive only: existing rows keep working (everyone defaults to 'email').
-- =============================================================================
-- Lets the owner book clients who don't use email/technology:
--   customers.contact_preference
--   bookings.suppress_comms — per-booking "don't email" switch, set by the
--   customers.email / bookings.customer_email become optional, so a client

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS contact_preference text NOT NULL DEFAULT 'email';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customers_contact_preference_check') THEN
    ALTER TABLE public.customers ADD CONSTRAINT customers_contact_preference_check
      CHECK (contact_preference IN ('email', 'phone', 'none'));
  END IF;
END$$;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS suppress_comms boolean NOT NULL DEFAULT false;

ALTER TABLE public.customers ALTER COLUMN email DROP NOT NULL;
ALTER TABLE public.bookings  ALTER COLUMN customer_email DROP NOT NULL;

-- A client with no email must at least have a phone number on the booking.
-- (customer_phone is already NOT NULL; this documents the intent.)

-- ---------------------------------------------------------------------------
-- 20261117_offline_consultation_notes.sql
-- ---------------------------------------------------------------------------
-- =============================================================================
-- Owner-recorded consultations + private client notes.
-- Apply in Supabase dashboard -> SQL Editor. Idempotent. Additive only.
-- =============================================================================
-- consultation_responses.consent_method — how consent was obtained:
--   'online' (default; the client filled in the web form themselves)
--   'verbal' (owner read the consent statement to the client, who agreed)
--   'paper'  (client signed the paper form; owner keeps it on file)
-- consultation_responses.recorded_by — 'client' (default) or 'owner'.
-- customers.notes — owner's private notes (access needs, preferences,
--   "call, don't text"); never shown to the client or emailed to them.
ALTER TABLE public.consultation_responses
  ADD COLUMN IF NOT EXISTS consent_method text NOT NULL DEFAULT 'online';
ALTER TABLE public.consultation_responses
  ADD COLUMN IF NOT EXISTS recorded_by text NOT NULL DEFAULT 'client';
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'consultation_consent_method_check') THEN
    ALTER TABLE public.consultation_responses ADD CONSTRAINT consultation_consent_method_check
      CHECK (consent_method IN ('online', 'verbal', 'paper'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'consultation_recorded_by_check') THEN
    ALTER TABLE public.consultation_responses ADD CONSTRAINT consultation_recorded_by_check
      CHECK (recorded_by IN ('client', 'owner'));
  END IF;
END$$;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS notes text;

-- ---------------------------------------------------------------------------
-- 20261118_attendance.sql
-- ---------------------------------------------------------------------------
-- =============================================================================
-- Attendance: did the client turn up? Apply in Supabase dashboard -> SQL Editor.
-- Idempotent. Additive only (NULL = not recorded, which is every existing row).
-- =============================================================================
-- Recorded by the owner after an appointment. A separate column rather than new
-- booking statuses, so slot locking, reminders and every existing status check
-- keep their meaning. no_show bookings are excluded from revenue and never get
-- a review request.
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS attendance text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS attendance_marked_at timestamptz;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_attendance_check') THEN
    ALTER TABLE public.bookings ADD CONSTRAINT bookings_attendance_check
      CHECK (attendance IN ('attended', 'no_show') OR attendance IS NULL);
  END IF;
END$$;

-- ---------------------------------------------------------------------------
-- 20261118_marketing_consent.sql
-- ---------------------------------------------------------------------------
-- =============================================================================
-- Marketing consent, one-click unsubscribe, rebook reminders.
-- Apply in Supabase dashboard -> SQL Editor. Idempotent. Additive only.
-- =============================================================================
-- UK PECR/GDPR: marketing email needs prior opt-in (unticked box) and a working
-- unsubscribe in every message. Everyone defaults to NOT opted in.
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS marketing_opt_in boolean NOT NULL DEFAULT false;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS marketing_opt_in_at timestamptz;
-- Unguessable per-client token for unsubscribe links (no sign-in needed).
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS unsubscribe_token uuid NOT NULL DEFAULT gen_random_uuid();
CREATE UNIQUE INDEX IF NOT EXISTS customers_unsubscribe_token_key ON public.customers (unsubscribe_token);
-- Claim-then-send flag for the "time for your next treatment" reminder.
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS rebook_reminder_sent_at timestamptz;

-- The REVOKE in the first section ran before later sections created columns —
-- re-apply so new columns are covered too (idempotent).
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

COMMIT;

-- =============================================================================
-- CHECKS (run after; both should return 0 rows)
-- =============================================================================
-- 1. No client-facing policies remain:
--    SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public';
--
-- 2. Was the old policy hole ever used? Any row = a client record whose login
--    belongs to a different email. Send to the developer before changing anything:
--    SELECT c.id, c.email AS customer_email, u.email AS login_email, c.created_at
--    FROM public.customers c JOIN auth.users u ON u.id = c.user_id
--    WHERE lower(u.email) <> lower(c.email);
