-- =============================================================================
-- Migration: 20240101000059_convert_product_code_to_integer.sql
-- Description: Converts products.code from text/varchar to integer.
--              Numeric legacy codes are preserved when possible. Non-numeric
--              and numeric-collision legacy codes receive the next available
--              sequential number per organization before the type swap.
-- =============================================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS code_number integer;

WITH normalized AS (
  SELECT
    id,
    organization_id,
    created_at,
    CASE
      WHEN btrim(code) ~ '^\d+$' THEN btrim(code)::integer
      ELSE NULL
    END AS numeric_code
  FROM public.products
),
ranked AS (
  SELECT
    *,
    row_number() OVER (
      PARTITION BY organization_id, numeric_code
      ORDER BY created_at NULLS LAST, id
    ) AS duplicate_rank
  FROM normalized
),
preserved AS (
  SELECT
    id,
    organization_id,
    CASE
      WHEN numeric_code IS NOT NULL AND duplicate_rank = 1 THEN numeric_code
      ELSE NULL
    END AS preserved_code
  FROM ranked
),
org_max AS (
  SELECT
    organization_id,
    COALESCE(MAX(preserved_code), 0) AS max_preserved_code
  FROM preserved
  GROUP BY organization_id
),
to_assign AS (
  SELECT
    p.id,
    p.organization_id,
    row_number() OVER (
      PARTITION BY p.organization_id
      ORDER BY products.created_at NULLS LAST, products.id
    ) AS assigned_offset
  FROM preserved p
  JOIN public.products AS products
    ON products.id = p.id
  WHERE p.preserved_code IS NULL
),
final_codes AS (
  SELECT
    p.id,
    COALESCE(
      p.preserved_code,
      org_max.max_preserved_code + to_assign.assigned_offset
    ) AS next_code
  FROM preserved p
  JOIN org_max
    ON org_max.organization_id = p.organization_id
  LEFT JOIN to_assign
    ON to_assign.id = p.id
)
UPDATE public.products AS products
SET code_number = final_codes.next_code
FROM final_codes
WHERE final_codes.id = products.id;

ALTER TABLE public.products
  ALTER COLUMN code_number SET NOT NULL;

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_organization_id_code_key;

DROP INDEX IF EXISTS public.products_organization_id_code_active_key;

ALTER TABLE public.products
  DROP COLUMN code;

ALTER TABLE public.products
  RENAME COLUMN code_number TO code;

ALTER TABLE public.products
  ADD CONSTRAINT products_code_positive_check
    CHECK (code > 0);

CREATE UNIQUE INDEX products_organization_id_code_active_key
  ON public.products (organization_id, code)
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN public.products.code IS 'Sequential numeric product code unique within each organization.';
