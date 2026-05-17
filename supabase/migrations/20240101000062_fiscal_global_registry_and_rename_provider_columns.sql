-- =============================================================================
-- Migration: 20240101000062_fiscal_global_registry_and_rename_provider_columns
-- Description:
--   1. Renames nuvem_fiscal_* columns in fiscal_sync_status to provider-agnostic names.
--   2. Converts fiscal_integration_endpoints from per-org to a global registry:
--      - Drops org-scoped RLS policies.
--      - Adds a simple authenticated-read policy (writes go through service role).
--      - Adds UNIQUE (function_name) so upsert-by-function-name is safe.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. fiscal_sync_status: rename provider-prefixed columns
-- ---------------------------------------------------------------------------

ALTER TABLE public.fiscal_sync_status
  RENAME COLUMN nuvem_fiscal_tax_id TO tax_id;

ALTER TABLE public.fiscal_sync_status
  RENAME COLUMN nuvem_fiscal_response_json TO provider_response_json;

-- Update comments to reflect new names
COMMENT ON COLUMN public.fiscal_sync_status.tax_id IS
  'CPF or CNPJ (up to 18 chars, digits only) registered with the fiscal provider.';

COMMENT ON COLUMN public.fiscal_sync_status.provider_response_json IS
  'Raw JSON response from the fiscal provider empresa endpoint, stored for debugging.';

-- ---------------------------------------------------------------------------
-- 2. fiscal_integration_endpoints: global registry
-- ---------------------------------------------------------------------------

-- Drop the org-scoped RLS policies
DROP POLICY IF EXISTS "fiscal_integration_endpoints_select_same_org" ON public.fiscal_integration_endpoints;
DROP POLICY IF EXISTS "fiscal_integration_endpoints_insert_same_org"  ON public.fiscal_integration_endpoints;
DROP POLICY IF EXISTS "fiscal_integration_endpoints_update_same_org"  ON public.fiscal_integration_endpoints;
DROP POLICY IF EXISTS "fiscal_integration_endpoints_delete_same_org"  ON public.fiscal_integration_endpoints;

-- Allow any authenticated user to read the global registry
CREATE POLICY "fiscal_integration_endpoints_select_authenticated"
  ON public.fiscal_integration_endpoints
  FOR SELECT TO authenticated
  USING (true);

-- Writes are done exclusively via service role (admin client), which bypasses RLS.
-- No INSERT/UPDATE/DELETE policies for authenticated role needed.

-- Add a unique constraint so upsert-by-function-name is safe and idempotent
ALTER TABLE public.fiscal_integration_endpoints
  ADD CONSTRAINT fiscal_integration_endpoints_function_name_unique
  UNIQUE (function_name);

-- Update table comment
COMMENT ON TABLE public.fiscal_integration_endpoints IS
  'Global registry of fiscal provider (Focus NFe) API endpoints used by the application. One row per logical function name; not scoped per organization.';
