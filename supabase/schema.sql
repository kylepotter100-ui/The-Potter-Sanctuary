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

-- ===== bookings =====
CREATE TABLE IF NOT EXISTS public.bookings (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
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

CREATE INDEX IF NOT EXISTS bookings_date_idx   ON public.bookings (booking_date);
CREATE INDEX IF NOT EXISTS bookings_status_idx ON public.bookings (status);

-- ===== Seed default availability =====
-- Tuesday–Saturday (2..6), every 30 minutes from 09:30 to 19:00 inclusive.
-- Re-running is safe thanks to the unique constraint.
INSERT INTO public.availability (day_of_week, slot_time, is_active)
SELECT day, slot, true
FROM generate_series(2, 6) AS day
CROSS JOIN generate_series('09:30'::time, '19:00'::time, interval '30 minutes') AS slot
ON CONFLICT (day_of_week, slot_time) DO NOTHING;
