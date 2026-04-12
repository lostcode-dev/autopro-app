-- =============================================================================
-- Migration: 20240101000008_create_master_products.sql
-- Description: Creates the master_products table — the canonical product/part
--              catalog for an organization. Concrete inventory items (SKUs,
--              stock lots, etc.) reference this master record.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- TABLE: public.master_products
-- -----------------------------------------------------------------------------
CREATE TABLE public.master_products (
  -- Primary key
  id              uuid          NOT NULL DEFAULT gen_random_uuid(),

  -- Tenant scope
  organization_id uuid          NOT NULL
    REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Core fields
  name            varchar(200)  NOT NULL,
  description     text,
  notes           text,

  -- Audit columns
  created_at      timestamptz   NOT NULL DEFAULT now(),
  created_by      varchar(200),
  updated_at      timestamptz   NOT NULL DEFAULT now(),
  updated_by      varchar(200),
  deleted_at      timestamptz,
  deleted_by      varchar(200),

  CONSTRAINT master_products_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE  public.master_products             IS 'Canonical product/part definitions shared across all inventory and pricing records.';
COMMENT ON COLUMN public.master_products.name        IS 'Display name of the product or part (used in search and order lines).';
COMMENT ON COLUMN public.master_products.description IS 'Detailed product description visible to staff and optionally to customers.';
COMMENT ON COLUMN public.master_products.notes       IS 'Internal notes for stock management, sourcing, or handling instructions.';

-- -----------------------------------------------------------------------------
-- AUTO-UPDATE TRIGGER
-- -----------------------------------------------------------------------------
CREATE TRIGGER trg_master_products_updated_at
  BEFORE UPDATE ON public.master_products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- INDEXES
-- -----------------------------------------------------------------------------

-- Tenant lookup (active records only) — product lists and FK joins
CREATE INDEX idx_master_products_organization_id
  ON public.master_products (organization_id)
  WHERE deleted_at IS NULL;

-- Full-text search on name (active records only) — product search / autocomplete
CREATE INDEX idx_master_products_name_fts
  ON public.master_products USING gin (to_tsvector('portuguese', name))
  WHERE deleted_at IS NULL;

-- -----------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- -----------------------------------------------------------------------------
ALTER TABLE public.master_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "master_products_select_same_org" ON public.master_products
  FOR SELECT TO authenticated
  USING (organization_id = public.current_user_organization_id());

CREATE POLICY "master_products_insert_same_org" ON public.master_products
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.current_user_organization_id());

CREATE POLICY "master_products_update_same_org" ON public.master_products
  FOR UPDATE TO authenticated
  USING  (organization_id = public.current_user_organization_id())
  WITH CHECK (organization_id = public.current_user_organization_id());

CREATE POLICY "master_products_delete_same_org" ON public.master_products
  FOR DELETE TO authenticated
  USING (organization_id = public.current_user_organization_id());
