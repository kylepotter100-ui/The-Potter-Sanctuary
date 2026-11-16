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
