-- ============================================================================
-- Phone-as-second-match-key — normalized phone column for customer identity.
--
-- Apply this BEFORE deploying the code that matches customers by phone. Every
-- statement is safe to run against the live DB while current production code is
-- still serving traffic: it only ADDS a generated column + index; nothing the
-- existing booking path writes changes, and reads of the new column simply
-- return data that's now populated.
--
-- WHY: customers were matched/created by email only, so a typo'd email created a
-- phantom customer and hid the returning customer's reviews/questionnaire/history
-- (all keyed on customer_id). The booking route now reconciles a brand-new email
-- against an exact, normalized phone match before creating a new customer.
--
-- The expression MIRRORS lib/phone.ts `normalizePhone` (digits-only, then
-- collapse the +44 / 0044 country code to the trunk "0"). Keep the two in
-- lockstep — tests/phone.test.ts guards the TS side.
--
-- STORED generated column: Postgres computes phone_normalized for every existing
-- row at ALTER time and for every future write, so there is no separate backfill.
--
-- Idempotent: safe to re-run.
-- ============================================================================

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS phone_normalized text GENERATED ALWAYS AS (
    CASE
      WHEN regexp_replace(phone_number, '[^0-9]', '', 'g') LIKE '0044%'
        THEN '0' || substring(regexp_replace(phone_number, '[^0-9]', '', 'g') from 5)
      WHEN regexp_replace(phone_number, '[^0-9]', '', 'g') LIKE '44%'
        AND length(regexp_replace(phone_number, '[^0-9]', '', 'g')) = 12
        THEN '0' || substring(regexp_replace(phone_number, '[^0-9]', '', 'g') from 3)
      ELSE regexp_replace(phone_number, '[^0-9]', '', 'g')
    END
  ) STORED;

-- Partial index: skip rows with no usable phone so the lookup stays tight.
CREATE INDEX IF NOT EXISTS customers_phone_normalized_idx
  ON public.customers (phone_normalized)
  WHERE phone_normalized <> '';
