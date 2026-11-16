-- =============================================================================
-- Contact preferences + email-free manual bookings.
-- Apply in Supabase dashboard -> SQL Editor. Idempotent: safe to re-run.
-- Additive only: existing rows keep working (everyone defaults to 'email').
-- =============================================================================
-- Lets the owner book clients who don't use email/technology:
--   customers.contact_preference
--     'email' (default) — normal automated emails
--     'phone'           — never email; owner phones them (shown on the
--                         morning summary call list)
--     'none'            — never contact automatically at all
--   bookings.suppress_comms — per-booking "don't email" switch, set by the
--     owner when making a manual reservation.
--   customers.email / bookings.customer_email become optional, so a client
--     can be booked with just a name and phone number. Email stays UNIQUE
--     where present (Postgres treats NULLs as distinct).

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
