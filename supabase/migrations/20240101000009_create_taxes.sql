-- =============================================================================
-- Migration: 20240101000009_create_taxes.sql
-- Description: Creates the taxes table for storing Brazilian tax definitions
--              (ISS, ICMS, IPI, PIS, COFINS, etc.) scoped per organization.
--              Rates are stored as percentages (e.g. 5.0000 = 5%).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- TABLE: public.taxes
-- -----------------------------------------------------------------------------
CREATE TABLE public.taxes (
  -- Primary key
  id              uuid           NOT NULL DEFAULT gen_random_uuid(),

  -- Tenant scope
  organization_id uuid           NOT NULL
    REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Core fields
  name            varchar(50)    NOT NULL,  -- e.g. ISS, ICMS, IPI, PIS, COFINS
  type            varchar(20)    NOT NULL
    CHECK (type IN ('municipal', 'state', 'federal')),
  rate            numeric(8, 4)  NOT NULL,  -- percentage, e.g. 5.0000 = 5%

  -- Audit columns
  created_at      timestamptz    NOT NULL DEFAULT now(),
  created_by      varchar(200),
  updated_at      timestamptz    NOT NULL DEFAULT now(),
  updated_by      varchar(200),
  deleted_at      timestamptz,
  deleted_by      varchar(200),

  CONSTRAINT taxes_pkey        PRIMARY KEY (id),
  -- An organization cannot have two taxes with the same name
  CONSTRAINT taxes_org_name_uq UNIQUE (organization_id, name)
);

COMMENT ON TABLE  public.taxes       IS 'Tax definitions (ISS, ICMS, IPI, etc.) configured per organization for use in fiscal documents and service orders.';
COMMENT ON COLUMN public.taxes.name  IS 'Tax identifier, e.g. ISS, ICMS, IPI, PIS, COFINS.';
COMMENT ON COLUMN public.taxes.type  IS 'Fiscal jurisdiction: municipal | state | federal.';
COMMENT ON COLUMN public.taxes.rate  IS 'Tax rate as a percentage with 4 decimal places, e.g. 5.0000 represents 5%.';

-- -----------------------------------------------------------------------------
-- AUTO-UPDATE TRIGGER
-- -----------------------------------------------------------------------------
CREATE TRIGGER trg_taxes_updated_at
  BEFORE UPDATE ON public.taxes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- INDEXES
-- -----------------------------------------------------------------------------

-- Tenant lookup (active records only) — general tax list
CREATE INDEX idx_taxes_organization_id
  ON public.taxes (organization_id)
  WHERE deleted_at IS NULL;

-- Tenant + jurisdiction composite — filter by municipal/state/federal
CREATE INDEX idx_taxes_organization_id_type
  ON public.taxes (organization_id, type)
  WHERE deleted_at IS NULL;

-- -----------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- -----------------------------------------------------------------------------
ALTER TABLE public.taxes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "taxes_select_same_org" ON public.taxes
  FOR SELECT TO authenticated
  USING (organization_id = public.current_user_organization_id());

CREATE POLICY "taxes_insert_same_org" ON public.taxes
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.current_user_organization_id());

CREATE POLICY "taxes_update_same_org" ON public.taxes
  FOR UPDATE TO authenticated
  USING  (organization_id = public.current_user_organization_id())
  WITH CHECK (organization_id = public.current_user_organization_id());

CREATE POLICY "taxes_delete_same_org" ON public.taxes
  FOR DELETE TO authenticated
  USING (organization_id = public.current_user_organization_id());
