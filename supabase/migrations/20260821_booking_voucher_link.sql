-- ============================================================================
-- Voucher-funded bookings — link `bookings` to `vouchers`.
--
-- Run this in the Supabase dashboard -> SQL Editor BEFORE deploying the branch.
-- Idempotent; safe to re-run. Keep supabase/schema.sql in lockstep.
--
-- WHY: vouchers and bookings are currently unlinked, so a £50 paid voucher is
-- counted as revenue twice — once when the voucher is issued (paid offline)
-- and again when the funded booking is confirmed. One payment, counted twice.
-- `voucher_id` is BOTH the link and the revenue marker: revenue queries exclude
-- rows where it is set, because that money was already counted at issue time.
--
-- PURELY ADDITIVE: the column is nullable and every existing row keeps NULL,
-- so current code (which never writes it) is unaffected and all revenue figures
-- are unchanged until a booking is actually voucher-funded.
--
-- ON DELETE RESTRICT is deliberate and NOT the house SET NULL used elsewhere
-- (bookings.customer_id, reviews.booking_id). Nulling this link would silently
-- turn a £0 voucher-funded booking back into countable revenue — a money bug
-- that would be invisible after the fact. Deleting a voucher that funded a
-- booking should fail loudly instead. Note this makes
-- scripts/sql/vouchers-delete-all.sql fail while any booking links a voucher;
-- delete the bookings first.
-- ============================================================================

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS voucher_id uuid
    REFERENCES public.vouchers(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS bookings_voucher_id_idx
  ON public.bookings (voucher_id);

-- One voucher funds at most ONE LIVE booking. The partial predicate is
-- load-bearing: cancelling a voucher-funded booking reverts the voucher to
-- 'active' so the client can rebook, and that rebooking is only possible
-- because the cancelled row has dropped out of this index. A plain unique
-- index here would permanently burn the voucher on the first cancellation.
CREATE UNIQUE INDEX IF NOT EXISTS bookings_voucher_active_unique
  ON public.bookings (voucher_id)
  WHERE voucher_id IS NOT NULL AND status IN ('pending', 'confirmed');

-- ============================================================================
-- VERIFICATION (run after; read-only)
--
-- A. Column + FK action. Expect: uuid | nullable = t | fk_delete_action = 'r'
--    ('r' = RESTRICT; 'n' would mean SET NULL, which is the money bug above.)
--
--   SELECT a.attname AS column_name,
--          format_type(a.atttypid, a.atttypmod) AS type,
--          NOT a.attnotnull AS nullable,
--          c.confdeltype  AS fk_delete_action
--   FROM pg_attribute a
--   LEFT JOIN pg_constraint c
--     ON c.conrelid = a.attrelid AND a.attnum = ANY (c.conkey) AND c.contype = 'f'
--   WHERE a.attrelid = 'public.bookings'::regclass AND a.attname = 'voucher_id';
--
-- B. BOTH indexes, with full definitions. bookings_voucher_active_unique MUST
--    show its WHERE clause — without it, rebooking after a cancellation breaks.
--
--   SELECT indexname, indexdef
--   FROM pg_indexes
--   WHERE schemaname = 'public' AND tablename = 'bookings'
--     AND indexname LIKE 'bookings_voucher%'
--   ORDER BY indexname;
--
-- C. Proves this is a no-op on existing data. Expect with_voucher = 0.
--
--   SELECT count(*) AS total_bookings, count(voucher_id) AS with_voucher
--   FROM public.bookings;
-- ============================================================================
