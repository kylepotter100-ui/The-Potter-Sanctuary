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
  message             text,
  status              text NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','confirmed','cancelled')),
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- For pre-existing tables created before this version — add the FK column.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL;

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

-- ===== Seed default availability =====
-- Tuesday–Saturday (2..6), every 30 minutes from 09:30 to 19:00 inclusive.
-- Re-running is safe thanks to the unique constraint.
INSERT INTO public.availability (day_of_week, slot_time, is_active)
SELECT day, slot, true
FROM generate_series(2, 6) AS day
CROSS JOIN generate_series('09:30'::time, '19:00'::time, interval '30 minutes') AS slot
ON CONFLICT (day_of_week, slot_time) DO NOTHING;
