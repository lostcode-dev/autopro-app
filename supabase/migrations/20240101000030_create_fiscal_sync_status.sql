-- =============================================================================
-- Migration: 20240101000030_create_fiscal_sync_status
-- Description: Creates the fiscal_sync_status table, which holds one row per
--              organization and tracks the Nuvem Fiscal integration state.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- TABLE
-- ---------------------------------------------------------------------------
CREATE TABLE public.fiscal_sync_status (
  -- Primary key
  id                          uuid                NOT NULL DEFAULT gen_random_uuid(),

  -- Tenant reference (1-to-1 with organizations)
  organization_id             uuid                NOT NULL
    REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Nuvem Fiscal registration details
  nuvem_fiscal_tax_id         varchar(18),        -- CPF/CNPJ registered in Nuvem Fiscal

  -- Overall integration status
  integration_status          varchar(20)
    CHECK (integration_status IN ('active', 'inactive', 'error', 'not_configured')),

  -- Sync state
  is_company_synced           boolean             NOT NULL DEFAULT false,
  sync_status                 varchar(20)
    CHECK (sync_status IN ('synced', 'pending', 'error', 'never')),
  sync_error_message          text,
  sync_error_code             varchar(50),
  last_synced_at              timestamptz,
  last_sync_attempt_at        timestamptz,

  -- Region / state configuration
  is_region_supported         boolean,
  selected_state              char(2),            -- Brazilian state abbreviation, e.g. 'SP'

  -- Validation metadata
  last_validation_at          timestamptz,

  -- Raw response from Nuvem Fiscal (stored as JSON text for auditability)
  nuvem_fiscal_response_json  text,

  -- Audit columns
  created_at                  timestamptz         NOT NULL DEFAULT now(),
  created_by                  varchar(200),
  updated_at                  timestamptz         NOT NULL DEFAULT now(),
  updated_by                  varchar(200),
  deleted_at                  timestamptz,
  deleted_by                  varchar(200),

  -- Constraints
  CONSTRAINT fiscal_sync_status_pkey         PRIMARY KEY (id),
  CONSTRAINT fiscal_sync_status_org_unique   UNIQUE (organization_id)  -- one row per org
);

COMMENT ON TABLE  public.fiscal_sync_status IS
  'One row per organization; tracks the Nuvem Fiscal fiscal integration state.';
COMMENT ON COLUMN public.fiscal_sync_status.nuvem_fiscal_tax_id IS
  'CPF or CNPJ (up to 18 chars with mask) registered with Nuvem Fiscal.';
COMMENT ON COLUMN public.fiscal_sync_status.integration_status IS
  'Overall health of the Nuvem Fiscal integration: active | inactive | error | not_configured.';
COMMENT ON COLUMN public.fiscal_sync_status.sync_status IS
  'Last known sync result: synced | pending | error | never.';
COMMENT ON COLUMN public.fiscal_sync_status.selected_state IS
  'Two-letter Brazilian state code used for NFS-e regional configuration.';
COMMENT ON COLUMN public.fiscal_sync_status.nuvem_fiscal_response_json IS
  'Raw JSON response from the Nuvem Fiscal empresa endpoint, stored for debugging.';

-- ---------------------------------------------------------------------------
-- AUTO-UPDATE TRIGGER (updated_at)
-- ---------------------------------------------------------------------------
CREATE TRIGGER trg_fiscal_sync_status_updated_at
  BEFORE UPDATE ON public.fiscal_sync_status
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- INDEXES
-- The UNIQUE constraint on organization_id already provides an index.
-- We add a partial index for soft-delete-aware queries.
-- ---------------------------------------------------------------------------
CREATE INDEX idx_fiscal_sync_status_org_active
  ON public.fiscal_sync_status (organization_id)
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- ROW-LEVEL SECURITY
-- ---------------------------------------------------------------------------
ALTER TABLE public.fiscal_sync_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fiscal_sync_status_select_same_org"
  ON public.fiscal_sync_status
  FOR SELECT TO authenticated
  USING (organization_id = public.current_user_organization_id());

CREATE POLICY "fiscal_sync_status_insert_same_org"
  ON public.fiscal_sync_status
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.current_user_organization_id());

CREATE POLICY "fiscal_sync_status_update_same_org"
  ON public.fiscal_sync_status
  FOR UPDATE TO authenticated
  USING  (organization_id = public.current_user_organization_id())
  WITH CHECK (organization_id = public.current_user_organization_id());

CREATE POLICY "fiscal_sync_status_delete_same_org"
  ON public.fiscal_sync_status
  FOR DELETE TO authenticated
  USING (organization_id = public.current_user_organization_id());
