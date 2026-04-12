-- =============================================================================
-- Migration: 20240101000007_create_product_categories.sql
-- Description: Creates the product_categories table for organizing products
--              and parts within each organization's catalog.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- TABLE: public.product_categories
-- -----------------------------------------------------------------------------
CREATE TABLE public.product_categories (
  -- Primary key
  id              uuid          NOT NULL DEFAULT gen_random_uuid(),

  -- Tenant scope
  organization_id uuid          NOT NULL
    REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Core fields
  name            varchar(100)  NOT NULL,
  description     text,

  -- Audit columns
  created_at      timestamptz   NOT NULL DEFAULT now(),
  created_by      varchar(200),
  updated_at      timestamptz   NOT NULL DEFAULT now(),
  updated_by      varchar(200),
  deleted_at      timestamptz,
  deleted_by      varchar(200),

  CONSTRAINT product_categories_pkey        PRIMARY KEY (id),
  CONSTRAINT product_categories_org_name_uq UNIQUE (organization_id, name)
);

COMMENT ON TABLE  public.product_categories             IS 'Product/part categories used to group inventory items within an organization.';
COMMENT ON COLUMN public.product_categories.description IS 'Optional description of what kinds of products belong to this category.';

-- -----------------------------------------------------------------------------
-- AUTO-UPDATE TRIGGER
-- -----------------------------------------------------------------------------
CREATE TRIGGER trg_product_categories_updated_at
  BEFORE UPDATE ON public.product_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- INDEXES
-- -----------------------------------------------------------------------------

-- Tenant lookup (active records only) — category list and pickers
CREATE INDEX idx_product_categories_organization_id
  ON public.product_categories (organization_id)
  WHERE deleted_at IS NULL;

-- -----------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- -----------------------------------------------------------------------------
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "product_categories_select_same_org" ON public.product_categories
  FOR SELECT TO authenticated
  USING (organization_id = public.current_user_organization_id());

CREATE POLICY "product_categories_insert_same_org" ON public.product_categories
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.current_user_organization_id());

CREATE POLICY "product_categories_update_same_org" ON public.product_categories
  FOR UPDATE TO authenticated
  USING  (organization_id = public.current_user_organization_id())
  WITH CHECK (organization_id = public.current_user_organization_id());

CREATE POLICY "product_categories_delete_same_org" ON public.product_categories
  FOR DELETE TO authenticated
  USING (organization_id = public.current_user_organization_id());
