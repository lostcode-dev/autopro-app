-- =============================================================================
-- Migration: 20240101000031_create_fiscal_integration_endpoints
-- Description: Creates the fiscal_integration_endpoints table, which acts as a
--              registry of Nuvem Fiscal API endpoints used by the application.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- TABLE
-- ---------------------------------------------------------------------------
CREATE TABLE public.fiscal_integration_endpoints (
  -- Primary key
  id                uuid          NOT NULL DEFAULT gen_random_uuid(),

  -- Tenant reference
  organization_id   uuid
    REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Endpoint metadata
  function_name     varchar(100),                 -- Logical function/edge-function name
  method            varchar(10),                  -- HTTP method: GET, POST, PUT, DELETE, etc.
  path              varchar(300),                 -- API path template
  integration       varchar(50),                  -- Integration type, e.g. 'nuvemfiscal'
  description       text,                         -- Human-readable description of the endpoint

  -- Lifecycle
  is_active         boolean       NOT NULL DEFAULT true,
  source            varchar(100),                 -- Origin module or edge function that owns this entry

  -- Audit columns
  created_at        timestamptz   NOT NULL DEFAULT now(),
  created_by        varchar(200),
  updated_at        timestamptz   NOT NULL DEFAULT now(),
  updated_by        varchar(200),
  deleted_at        timestamptz,
  deleted_by        varchar(200),

  -- Constraints
  CONSTRAINT fiscal_integration_endpoints_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE  public.fiscal_integration_endpoints IS
  'Registry of Nuvem Fiscal (and other fiscal provider) API endpoints used by the application.';
COMMENT ON COLUMN public.fiscal_integration_endpoints.function_name IS
  'Logical name of the Supabase edge function or server module that calls this endpoint.';
COMMENT ON COLUMN public.fiscal_integration_endpoints.method IS
  'HTTP method used when calling this endpoint (GET, POST, PUT, PATCH, DELETE).';
COMMENT ON COLUMN public.fiscal_integration_endpoints.path IS
  'API path template, may contain path parameters (e.g. /nfse/{id}).';
COMMENT ON COLUMN public.fiscal_integration_endpoints.integration IS
  'Integration provider identifier, e.g. ''nuvemfiscal''.';
COMMENT ON COLUMN public.fiscal_integration_endpoints.source IS
  'Origin module or edge function that registered this endpoint entry.';

-- ---------------------------------------------------------------------------
-- AUTO-UPDATE TRIGGER (updated_at)
-- ---------------------------------------------------------------------------
CREATE TRIGGER trg_fiscal_integration_endpoints_updated_at
  BEFORE UPDATE ON public.fiscal_integration_endpoints
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- INDEXES
-- ---------------------------------------------------------------------------

-- Partial index for org-scoped queries on active (non-deleted) rows
CREATE INDEX idx_fiscal_integration_endpoints_org_active
  ON public.fiscal_integration_endpoints (organization_id)
  WHERE deleted_at IS NULL;

-- Composite index for looking up endpoints by integration provider + function name
CREATE INDEX idx_fiscal_integration_endpoints_integration_fn
  ON public.fiscal_integration_endpoints (integration, function_name)
  WHERE deleted_at IS NULL;

-- FK column index (organization_id already covered above; explicit for clarity)
CREATE INDEX idx_fiscal_integration_endpoints_org_id
  ON public.fiscal_integration_endpoints (organization_id);

-- ---------------------------------------------------------------------------
-- ROW-LEVEL SECURITY
-- ---------------------------------------------------------------------------
ALTER TABLE public.fiscal_integration_endpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fiscal_integration_endpoints_select_same_org"
  ON public.fiscal_integration_endpoints
  FOR SELECT TO authenticated
  USING (organization_id = public.current_user_organization_id());

CREATE POLICY "fiscal_integration_endpoints_insert_same_org"
  ON public.fiscal_integration_endpoints
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.current_user_organization_id());

CREATE POLICY "fiscal_integration_endpoints_update_same_org"
  ON public.fiscal_integration_endpoints
  FOR UPDATE TO authenticated
  USING  (organization_id = public.current_user_organization_id())
  WITH CHECK (organization_id = public.current_user_organization_id());

CREATE POLICY "fiscal_integration_endpoints_delete_same_org"
  ON public.fiscal_integration_endpoints
  FOR DELETE TO authenticated
  USING (organization_id = public.current_user_organization_id());
