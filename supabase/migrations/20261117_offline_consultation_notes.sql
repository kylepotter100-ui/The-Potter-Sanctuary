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
