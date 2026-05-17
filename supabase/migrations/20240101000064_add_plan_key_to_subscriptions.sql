-- ============================================================
-- Migration: 20240101000064_add_plan_key_to_subscriptions.sql
-- Description: Adds plan_key column to subscriptions table.
--              Stores the canonical plan identifier (starter/pro/fiscal)
--              used for license enforcement.
-- ============================================================

ALTER TABLE public.subscriptions
    ADD COLUMN IF NOT EXISTS plan_key varchar(20)
        CONSTRAINT subscriptions_plan_key_check
        CHECK (plan_key IN ('starter', 'pro', 'fiscal'));

COMMENT ON COLUMN public.subscriptions.plan_key IS 'Canonical plan key used for license enforcement: starter | pro | fiscal.';

-- Backfill existing rows from plan_name when possible
UPDATE public.subscriptions
SET plan_key = CASE
    WHEN lower(plan_name) LIKE '%starter%' THEN 'starter'
    WHEN lower(plan_name) LIKE '%pro%'     THEN 'pro'
    WHEN lower(plan_name) LIKE '%fiscal%'  THEN 'fiscal'
    ELSE NULL
END
WHERE plan_key IS NULL AND plan_name IS NOT NULL;
