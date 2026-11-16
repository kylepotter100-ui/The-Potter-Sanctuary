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
