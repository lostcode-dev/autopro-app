-- =============================================================================
-- Migration: 20240101000066_add_contact_to_fiscal_sync_status
-- Description: Adds contact_name and contact_cpf columns to fiscal_sync_status
--              to persist the responsible person data used for fiscal emission.
-- =============================================================================

ALTER TABLE public.fiscal_sync_status
  ADD COLUMN IF NOT EXISTS contact_name varchar(200),
  ADD COLUMN IF NOT EXISTS contact_cpf  varchar(14);

COMMENT ON COLUMN public.fiscal_sync_status.contact_name IS
  'Nome do responsável pela empresa (nome_responsavel) para integração fiscal.';
COMMENT ON COLUMN public.fiscal_sync_status.contact_cpf IS
  'CPF do responsável pela empresa (cpf_responsavel) para integração fiscal.';
