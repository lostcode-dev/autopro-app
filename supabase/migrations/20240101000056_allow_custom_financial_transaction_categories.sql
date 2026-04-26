-- =============================================================================
-- Migration: 20240101000056_allow_custom_financial_transaction_categories.sql
-- Description: Allows legacy/custom financial transaction categories to be
--              preserved instead of being collapsed into fixed buckets.
-- =============================================================================

ALTER TABLE public.financial_transactions
  DROP CONSTRAINT IF EXISTS financial_transactions_category_check;

ALTER TABLE public.financial_transactions
  ALTER COLUMN category TYPE varchar(100);

COMMENT ON COLUMN public.financial_transactions.category IS
  'Free-form financial category label. Legacy data keeps original categories such as PROLABORE, PEÇAS, FINANCIAMENTO, etc.';
