-- ============================================================================
-- PHASE A — Duration-aware blocking, backwards-compatible migration.
--
-- Apply this FIRST, BEFORE merging the duration-aware code to main. Every
-- statement here is safe to run against the live DB while the CURRENT
-- production code (which does not yet write duration_minutes) is still serving
-- traffic: the new column is NULLABLE, and the 15-min grid / override expansion
-- only add rows the old code already tolerates.
--
-- Phase B (SET NOT NULL + exclusion constraint) is in the sibling file and must
-- only run AFTER the new code is live.
--
-- Idempotent: safe to re-run.
-- ============================================================================

-- 1. New column, nullable for now so existing-code inserts still succeed.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS duration_minutes int;

-- 2. Backfill existing rows with their ORIGINAL (as-sold) durations, mapped by
--    treatment_id. This preserves the real footprint of appointments already
--    sold at the old length (hot-stones-full was 75, hot-stones-back was 45).
--    Only touch rows not yet backfilled so re-runs are harmless.
UPDATE public.bookings SET duration_minutes = 75
  WHERE treatment_id = 'hot-stones-full'        AND duration_minutes IS NULL;
UPDATE public.bookings SET duration_minutes = 45
  WHERE treatment_id = 'hot-stones-back'        AND duration_minutes IS NULL;
UPDATE public.bookings SET duration_minutes = 60
  WHERE treatment_id = 'full-body-aromatherapy' AND duration_minutes IS NULL;
UPDATE public.bookings SET duration_minutes = 30
  WHERE treatment_id = 'back-neck-scalp'        AND duration_minutes IS NULL;
-- Safety net for any unexpected treatment_id: assume a 60-min footprint rather
-- than leaving a NULL that would later block SET NOT NULL.
UPDATE public.bookings SET duration_minutes = 60
  WHERE duration_minutes IS NULL;

-- 3. Re-seed the availability template onto a 15-minute grid.
--    Insert 09:30 through 18:45 inclusive (the last OCCUPIABLE segment) for
--    Tuesday–Saturday (2..6). ON CONFLICT DO NOTHING leaves existing :00/:30
--    rows untouched and only adds the new :15/:45/18:45 segments.
INSERT INTO public.availability (day_of_week, slot_time, is_active)
SELECT
  day,
  (('09:30'::time) + (slot_number * interval '15 minutes')) AS slot_time,
  true
FROM
  generate_series(2, 6)  AS day,
  generate_series(0, 37) AS slot_number   -- 09:30 .. 18:45 inclusive (38 segs)
ON CONFLICT (day_of_week, slot_time) DO NOTHING;

-- 19:00 is the closing time, not an occupiable start segment — drop it.
DELETE FROM public.availability WHERE slot_time = '19:00'::time;

-- 4. Expand existing slot_overrides onto the 15-min grid. Under the old 30-min
--    grid, an override on a :00 or :30 boundary implicitly governed the adjacent
--    :15 / :45 sub-segment too. Copy the same is_active onto that sub-segment so
--    a previously-closed 30-min block doesn't silently half-reopen. ON CONFLICT
--    DO NOTHING preserves any override the owner already set on the sub-segment.
INSERT INTO public.slot_overrides (override_date, slot_time, is_active)
SELECT override_date, slot_time + interval '15 minutes', is_active
FROM public.slot_overrides
WHERE extract(minute FROM slot_time) IN (0, 30)
  AND slot_time < '19:00'::time
ON CONFLICT (override_date, slot_time) DO NOTHING;

-- Drop any per-date overrides at/after 19:00, mirroring the 19:00 delete on the
-- availability template above. 19:00 is the closing time and can never be a
-- valid start (a session beginning then can't finish by close), so these rows
-- are inert orphaned state under the new 15-min grid (which ends at 18:45).
-- Removing them keeps slot_overrides consistent with the template. This runs
-- AFTER the expansion step, which already filtered to slot_time < '19:00', so
-- the expansion is unaffected.
DELETE FROM public.slot_overrides WHERE slot_time >= '19:00'::time;
