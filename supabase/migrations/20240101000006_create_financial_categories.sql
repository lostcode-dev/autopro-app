-- =============================================================================
-- Migration: 20240101000006_create_financial_categories.sql
-- Description: Creates the financial_categories table for classifying income
--              and expense transactions within each organization.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- TABLE: public.financial_categories
-- -----------------------------------------------------------------------------
CREATE TABLE public.financial_categories (
  -- Primary key
  id              uuid          NOT NULL DEFAULT gen_random_uuid(),

  -- Tenant scope
  organization_id uuid          NOT NULL
    REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Core fields
  name            varchar(100)  NOT NULL,
  type            varchar(10)   NOT NULL
    CHECK (type IN ('income', 'expense')),

  -- Audit columns
  created_at      timestamptz   NOT NULL DEFAULT now(),
  created_by      varchar(200),
  updated_at      timestamptz   NOT NULL DEFAULT now(),
  updated_by      varchar(200),
  deleted_at      timestamptz,
  deleted_by      varchar(200),

  CONSTRAINT financial_categories_pkey           PRIMARY KEY (id),
  -- Each org can only have one category with a given name (across non-deleted records
  -- enforced at application level; DB unique covers all rows including soft-deleted)
  CONSTRAINT financial_categories_org_name_uq    UNIQUE (organization_id, name)
);

COMMENT ON TABLE  public.financial_categories       IS 'Income and expense category labels used to classify financial transactions.';
COMMENT ON COLUMN public.financial_categories.type  IS 'income | expense — determines whether this category applies to receivables or payables.';

-- -----------------------------------------------------------------------------
-- AUTO-UPDATE TRIGGER
-- -----------------------------------------------------------------------------
CREATE TRIGGER trg_financial_categories_updated_at
  BEFORE UPDATE ON public.financial_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- INDEXES
-- -----------------------------------------------------------------------------

-- Tenant lookup (active records only) — general category list
CREATE INDEX idx_financial_categories_organization_id
  ON public.financial_categories (organization_id)
  WHERE deleted_at IS NULL;

-- Tenant + type composite — filter by income or expense
CREATE INDEX idx_financial_categories_organization_id_type
  ON public.financial_categories (organization_id, type)
  WHERE deleted_at IS NULL;

-- -----------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- -----------------------------------------------------------------------------
ALTER TABLE public.financial_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "financial_categories_select_same_org" ON public.financial_categories
  FOR SELECT TO authenticated
  USING (organization_id = public.current_user_organization_id());

CREATE POLICY "financial_categories_insert_same_org" ON public.financial_categories
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.current_user_organization_id());

CREATE POLICY "financial_categories_update_same_org" ON public.financial_categories
  FOR UPDATE TO authenticated
  USING  (organization_id = public.current_user_organization_id())
  WITH CHECK (organization_id = public.current_user_organization_id());

CREATE POLICY "financial_categories_delete_same_org" ON public.financial_categories
  FOR DELETE TO authenticated
  USING (organization_id = public.current_user_organization_id());
