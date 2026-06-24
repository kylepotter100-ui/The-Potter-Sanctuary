-- Run this in Supabase dashboard → SQL Editor to create the required tables.
-- Idempotent: safe to re-run; uses IF NOT EXISTS where possible.

-- ===== availability =====
-- One row per (day_of_week, slot_time). day_of_week: 0=Sunday … 6=Saturday.
CREATE TABLE IF NOT EXISTS public.availability (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week   int     NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  slot_time     time    NOT NULL,
  is_active     boolean NOT NULL DEFAULT true,
  CONSTRAINT availability_day_slot_unique UNIQUE (day_of_week, slot_time)
);

-- ===== blocked_dates =====
-- Studio-wide blackout dates (holidays, sickness, etc.).
CREATE TABLE IF NOT EXISTS public.blocked_dates (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocked_date date        NOT NULL UNIQUE,
  reason       text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ===== customers =====
-- A customer record exists from the first booking. user_id is filled in
-- later when the same email signs in via magic link.
CREATE TABLE IF NOT EXISTS public.customers (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  email                    text UNIQUE NOT NULL,
  full_name                text,
  first_name               text,
  last_name                text,
  phone_number             text,
  date_of_birth            date,
  address                  text,
  emergency_contact_name   text,
  emergency_contact_phone  text,
  gender                   text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customers_email_idx   ON public.customers (email);
CREATE INDEX IF NOT EXISTS customers_user_id_idx ON public.customers (user_id);

-- Normalized phone — a SECOND exact-match key for customer identity so a typo'd
-- email still matches a returning customer via their (correct) phone. STORED
-- generated column: auto-populates for every existing row on ALTER and stays
-- correct for future writes with zero app bookkeeping. The expression mirrors
-- lib/phone.ts `normalizePhone` (digits-only, then collapse +44/0044 to the
-- trunk "0"); the two MUST stay in lockstep or lookups silently miss.
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS phone_normalized text GENERATED ALWAYS AS (
    CASE
      WHEN regexp_replace(phone_number, '[^0-9]', '', 'g') LIKE '0044%'
        THEN '0' || substring(regexp_replace(phone_number, '[^0-9]', '', 'g') from 5)
      WHEN regexp_replace(phone_number, '[^0-9]', '', 'g') LIKE '44%'
        AND length(regexp_replace(phone_number, '[^0-9]', '', 'g')) = 12
        THEN '0' || substring(regexp_replace(phone_number, '[^0-9]', '', 'g') from 3)
      ELSE regexp_replace(phone_number, '[^0-9]', '', 'g')
    END
  ) STORED;

CREATE INDEX IF NOT EXISTS customers_phone_normalized_idx
  ON public.customers (phone_normalized)
  WHERE phone_normalized <> '';

-- ===== bookings =====
CREATE TABLE IF NOT EXISTS public.bookings (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id         uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_first_name text NOT NULL,
  customer_last_name  text NOT NULL,
  customer_email      text NOT NULL,
  customer_phone      text NOT NULL,
  customer_gender     text,
  treatment_id        text NOT NULL,
  treatment_name      text NOT NULL,
  treatment_price     int  NOT NULL,
  booking_date        date NOT NULL,
  booking_time        time NOT NULL,
  -- Session length in minutes. The bookable interval is
  -- [booking_time, booking_time + duration_minutes + 15) — session + a 15-min
  -- buffer. See lib/availability.ts (BUFFER_MINUTES) for the interval model.
  duration_minutes    int  NOT NULL,
  message             text,
  status              text NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','confirmed','cancelled')),
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- For pre-existing tables created before this version — add the FK column.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL;

-- Duration-aware blocking. On a pre-existing table the column is added nullable
-- here; the two-phase migration (supabase/migrations/*_phaseA/B_*) backfills it
-- and then promotes it to NOT NULL once the duration-aware code is live.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS duration_minutes int;

-- Cancellation metadata (Phase 2). Captures who cancelled, when, and why.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS cancellation_reason text;
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS cancelled_by text
    CHECK (cancelled_by IN ('customer', 'owner') OR cancelled_by IS NULL);

-- Consultation reminder tracking (Phase 4). Set when the hourly cron sends
-- a 12-hour-out reminder so we don't double-send.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS consultation_reminder_sent_at timestamptz;

-- 24-hour appointment reminder tracking (Phase 4 part 2). Same pattern.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS appointment_reminder_sent_at timestamptz;

-- Post-appointment review request tracking. Set when the review-request
-- cron emails the customer (feature-flagged off until post-launch).
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS review_email_sent_at timestamptz;

-- ===== reviews =====
-- Customer feedback submitted after a treatment. Built now, surfaced
-- post-launch via the REVIEWS_ENABLED flag.
CREATE TABLE IF NOT EXISTS public.reviews (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  rating      int  NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reviews_booking_id_idx ON public.reviews (booking_id);
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- ===== daily_summaries_sent =====
-- Dedupe row written once per UK day after the morning-summary email goes
-- out, so the hourly cron can skip subsequent runs on the same date.
CREATE TABLE IF NOT EXISTS public.daily_summaries_sent (
  summary_date date PRIMARY KEY,
  sent_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bookings_date_idx        ON public.bookings (booking_date);
CREATE INDEX IF NOT EXISTS bookings_status_idx      ON public.bookings (status);
CREATE INDEX IF NOT EXISTS bookings_customer_id_idx ON public.bookings (customer_id);

-- ===== consultation_responses =====
-- One row per submitted questionnaire. Linked to the customer (always)
-- and the booking that prompted it (usually).
CREATE TABLE IF NOT EXISTS public.consultation_responses (
  id                              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id                     uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  booking_id                      uuid REFERENCES public.bookings(id) ON DELETE SET NULL,
  -- Health history (boolean conditions packed into one jsonb column)
  conditions                      jsonb NOT NULL DEFAULT '{}'::jsonb,
  allergies_specify               text,
  other_medical_conditions        text,
  under_medical_care              boolean,
  medical_care_explanation        text,
  -- Massage preferences
  focus_areas                     text[] NOT NULL DEFAULT '{}',
  areas_to_avoid                  text,
  pressure_preference             text CHECK (pressure_preference IN ('Light','Medium','Firm') OR pressure_preference IS NULL),
  had_professional_massage_before boolean,
  -- Lifestyle
  experiences_stress_regularly    boolean,
  primary_reason                  text,
  additional_info                 text,
  -- Consent
  consent_given                   boolean NOT NULL DEFAULT false,
  signature_name                  text,
  consent_date                    date,
  created_at                      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS consultation_customer_id_idx ON public.consultation_responses (customer_id);
CREATE INDEX IF NOT EXISTS consultation_booking_id_idx  ON public.consultation_responses (booking_id);

-- ===== slot_overrides (Phase 4) =====
-- Per-date overrides on top of the day_of_week pattern in `availability`.
-- Used by the new admin availability workflow to fine-tune individual slots
-- on individual dates without disturbing the recurring weekly template.
-- A row with is_active=false hides that slot from the public calendar for
-- that date; is_active=true exposes a slot the day_of_week pattern would
-- have hidden. Whole-day closures still belong in `blocked_dates`.
CREATE TABLE IF NOT EXISTS public.slot_overrides (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  override_date date    NOT NULL,
  slot_time     time    NOT NULL,
  is_active     boolean NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT slot_overrides_unique UNIQUE (override_date, slot_time)
);
CREATE INDEX IF NOT EXISTS slot_overrides_date_idx ON public.slot_overrides (override_date);

-- ===== Row Level Security defaults =====
-- Enable RLS on every table that holds personal or health data so
-- fresh deployments are closed by default. Per-role policies live in
-- supabase/rls-policies.sql — that file must be run after this one.
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultation_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_summaries_sent ENABLE ROW LEVEL SECURITY;

-- ===== Active-slot uniqueness =====
-- Cheap identical-start guard. Two simultaneous inserts for the same
-- (date, time) where status is pending or confirmed will fail with a 23505
-- unique_violation; the booking API surfaces that as a friendly 409. The real
-- overlap protection is the exclusion constraint below.
CREATE UNIQUE INDEX IF NOT EXISTS bookings_active_slot_unique
ON public.bookings (booking_date, booking_time)
WHERE status IN ('pending', 'confirmed');

-- ===== No-overlap exclusion constraint (the atomic guarantee) =====
-- Rejects any two pending/confirmed bookings on the same date whose
-- [start, start + duration_minutes + 15) intervals intersect — session plus a
-- 15-min buffer, half-open so back-to-back bookings are legal. Requires
-- duration_minutes to be populated (see the two-phase migration), so this is
-- applied in Phase B once the duration-aware code is live.
CREATE EXTENSION IF NOT EXISTS btree_gist;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bookings_no_overlap'
  ) THEN
    ALTER TABLE public.bookings ADD CONSTRAINT bookings_no_overlap
      EXCLUDE USING gist (
        booking_date WITH =,
        tsrange(
          (booking_date + booking_time),
          (booking_date + booking_time
             + make_interval(mins => duration_minutes + 15)),
          '[)'
        ) WITH &&
      ) WHERE (status IN ('pending', 'confirmed'));
  END IF;
END$$;

-- ===== Seed default availability =====
-- Tuesday–Saturday (2..6), every 15 minutes from 09:30 to 18:45 inclusive.
-- 18:45 is the last OCCUPIABLE segment (a 30-min session starting 18:30 needs
-- it); 19:00 is the closing time, never an occupiable start. The open-set /
-- valid-start distinction is enforced in lib/availability.ts, not the seed.
-- Re-running is safe thanks to the unique constraint.
INSERT INTO public.availability (day_of_week, slot_time, is_active)
SELECT
  day,
  (('09:30'::time) + (slot_number * interval '15 minutes')) AS slot_time,
  true
FROM
  generate_series(2, 6)  AS day,
  generate_series(0, 37) AS slot_number
ON CONFLICT (day_of_week, slot_time) DO NOTHING;

-- ===== Booking-audit hardening (June 2026) =====
-- Applied by the owner via the Supabase dashboard SQL editor; recorded here so
-- the schema file matches the live database.

-- Row Level Security on every remaining public table. No policies are created
-- on purpose: with RLS enabled and zero policies these tables are
-- deny-by-default for the anon/authenticated PostgREST roles, while every app
-- path (API routes, server components, crons) uses the service role, which
-- bypasses RLS. Before this, `bookings` rows — customer names, emails,
-- phones — were readable AND writable by anyone holding the public anon key.
ALTER TABLE public.bookings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_dates  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slot_overrides ENABLE ROW LEVEL SECURITY;

-- Drop the legacy permissive INSERT policy on bookings. Enabling RLS above does
-- NOT remove pre-existing policies, so an earlier `"Anyone can insert bookings"
-- WITH CHECK (true)` (from supabase/rls-policies.sql) survived and let anyone
-- holding the public anon key insert rows directly via PostgREST, bypassing the
-- server-side validation in lib/booking-create.ts. Real bookings insert via the
-- service role (which bypasses RLS), so dropping it changes nothing for the app
-- and restores the intended deny-by-default. (Supabase advisor:
-- rls_policy_always_true.)
DROP POLICY IF EXISTS "Anyone can insert bookings" ON public.bookings;

-- One consultation snapshot per booking. Deliberately a FULL unique index,
-- not a partial one: PostgREST's ON CONFLICT inference (used by the
-- questionnaire/booking upserts via supabase-js `onConflict: "booking_id"`)
-- cannot target partial indexes. Postgres treats NULLs as distinct, so the
-- index still allows unlimited rows with booking_id IS NULL (unlinked
-- consultations) and only enforces uniqueness for real booking links.
-- MUST exist BEFORE the app code that upserts on booking_id is deployed —
-- without it those upserts fail ("no unique or exclusion constraint matching
-- the ON CONFLICT specification").
CREATE UNIQUE INDEX IF NOT EXISTS consultation_one_per_booking
  ON public.consultation_responses (booking_id);
