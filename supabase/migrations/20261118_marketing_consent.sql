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
