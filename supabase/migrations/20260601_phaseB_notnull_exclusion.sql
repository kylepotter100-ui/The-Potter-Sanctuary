-- ============================================================================
-- PHASE B — Duration-aware blocking, hard constraints.
--
-- Apply this LAST, AFTER the duration-aware code is live on main (so every new
-- booking already writes duration_minutes and respects the interval model).
-- Running this before the new code is deployed would break inserts from the
-- old code.
--
-- Pre-flight: Phase 0 overlap-detection found NO overlapping pending/confirmed
-- pairs under the new interval model, so the exclusion constraint creates
-- cleanly. Re-run that probe if bookings changed before applying.
--
-- Idempotent where Postgres allows.
-- ============================================================================

-- 1. Every row now has a duration (backfilled in Phase A + written by new code).
ALTER TABLE public.bookings
  ALTER COLUMN duration_minutes SET NOT NULL;

-- 2. btree_gist lets a GiST exclusion constraint combine the scalar equality on
--    booking_date with the range overlap on the interval.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 3. The atomic overlap guard. Rejects any two pending/confirmed bookings on the
--    same date whose [start, start + duration + 15min) intervals intersect.
--    Half-open '[)' bounds make back-to-back bookings (prev ends 14:00, buffer
--    to 14:15, next starts 14:15) legal. This is the real concurrency backstop;
--    bookings_active_slot_unique stays as a cheap identical-start guard.
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
