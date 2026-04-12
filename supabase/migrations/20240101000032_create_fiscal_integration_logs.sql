-- =============================================================================
-- Migration: 20240101000032_create_fiscal_integration_logs
-- Description: Creates the fiscal_integration_logs table, which stores
--              HTTP request/response logs for all Nuvem Fiscal API calls.
--              Rows are written by the service role (edge functions); authenticated
--              users can only SELECT their own organization's logs (read-only).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- TABLE
-- ---------------------------------------------------------------------------
CREATE TABLE public.fiscal_integration_logs (
  -- Primary key
  id                      uuid          NOT NULL DEFAULT gen_random_uuid(),

  -- Tenant reference (SET NULL on org deletion to preserve log history)
  organization_id         uuid
    REFERENCES public.organizations(id) ON DELETE SET NULL,

  -- Integration context
  integration             varchar(50),            -- e.g. 'nuvemfiscal'
  function_name           varchar(100),           -- Edge function or module that made the call

  -- HTTP request details
  request_method          varchar(10),            -- GET, POST, PUT, PATCH, DELETE
  request_url             text,                   -- Full URL including query string
  request_path            varchar(300),           -- Path portion only
  query_params_json       text,                   -- Query parameters serialised as JSON
  request_headers_json    text,                   -- Request headers (sensitive values should be redacted)
  request_body_json       text,                   -- Request payload serialised as JSON

  -- HTTP response details
  response_status         int,                    -- HTTP status code (e.g. 200, 400, 500)
  response_ok             boolean,                -- true when status is 2xx
  response_headers_json   text,                   -- Response headers serialised as JSON
  response_body_json      text,                   -- Response body serialised as JSON

  -- Performance
  duration_ms             int,                    -- Round-trip time in milliseconds

  -- Outcome
  is_success              boolean,                -- Application-level success flag
  error_message           text,                   -- Human-readable error description
  error_stack             text,                   -- Stack trace when available

  -- Actor
  user_email              varchar(200),           -- Email of the user that triggered the call

  -- Audit columns
  created_at              timestamptz   NOT NULL DEFAULT now(),
  created_by              varchar(200),
  updated_at              timestamptz   NOT NULL DEFAULT now(),
  updated_by              varchar(200),
  deleted_at              timestamptz,
  deleted_by              varchar(200),

  -- Constraints
  CONSTRAINT fiscal_integration_logs_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE  public.fiscal_integration_logs IS
  'Append-only HTTP request/response log for all Nuvem Fiscal API calls. '
  'Written exclusively by the service role (edge functions); users can only read their org''s logs.';
COMMENT ON COLUMN public.fiscal_integration_logs.integration IS
  'Integration provider identifier, e.g. ''nuvemfiscal''.';
COMMENT ON COLUMN public.fiscal_integration_logs.request_headers_json IS
  'Request headers stored as JSON. Sensitive values (Authorization, API keys) must be redacted before insertion.';
COMMENT ON COLUMN public.fiscal_integration_logs.response_ok IS
  'True when the HTTP response status code is in the 2xx range.';
COMMENT ON COLUMN public.fiscal_integration_logs.is_success IS
  'Application-level success flag; may differ from response_ok when the API returns 200 with an error body.';
COMMENT ON COLUMN public.fiscal_integration_logs.duration_ms IS
  'Total round-trip duration in milliseconds from request send to response received.';

-- ---------------------------------------------------------------------------
-- AUTO-UPDATE TRIGGER (updated_at)
-- ---------------------------------------------------------------------------
CREATE TRIGGER trg_fiscal_integration_logs_updated_at
  BEFORE UPDATE ON public.fiscal_integration_logs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- INDEXES
-- ---------------------------------------------------------------------------

-- Partial index for org-scoped queries on active (non-deleted) rows
CREATE INDEX idx_fiscal_integration_logs_org_active
  ON public.fiscal_integration_logs (organization_id)
  WHERE deleted_at IS NULL;

-- Composite: filter by org + integration provider
CREATE INDEX idx_fiscal_integration_logs_org_integration
  ON public.fiscal_integration_logs (organization_id, integration)
  WHERE deleted_at IS NULL;

-- Composite: filter by org + success/failure (useful for dashboards and alerting)
CREATE INDEX idx_fiscal_integration_logs_org_success
  ON public.fiscal_integration_logs (organization_id, is_success)
  WHERE deleted_at IS NULL;

-- Time-based querying and pagination (most recent first)
CREATE INDEX idx_fiscal_integration_logs_created_at
  ON public.fiscal_integration_logs (created_at DESC);

-- FK column index
CREATE INDEX idx_fiscal_integration_logs_org_id
  ON public.fiscal_integration_logs (organization_id);

-- ---------------------------------------------------------------------------
-- ROW-LEVEL SECURITY
-- Authenticated users: SELECT only (their own org).
-- Writes are performed by the service role from edge functions, which bypasses RLS.
-- ---------------------------------------------------------------------------
ALTER TABLE public.fiscal_integration_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fiscal_integration_logs_select_same_org"
  ON public.fiscal_integration_logs
  FOR SELECT TO authenticated
  USING (organization_id = public.current_user_organization_id());

-- No INSERT / UPDATE / DELETE policies for authenticated role intentionally.
-- All writes come from service-role edge functions.
