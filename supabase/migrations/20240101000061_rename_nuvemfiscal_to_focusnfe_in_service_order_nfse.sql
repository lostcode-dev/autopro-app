-- =============================================================================
-- Migration: 20240101000061_rename_nuvemfiscal_columns_in_service_order_nfse
-- Description: Renames all nuvemfiscal_* columns in service_order_nfse to
--              provider-agnostic English names, decoupling the schema from
--              Nuvem Fiscal (now replaced by Focus NFe).
--              Also drops/recreates the affected indexes.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- RENAME COLUMNS
-- ---------------------------------------------------------------------------
ALTER TABLE public.service_order_nfse
  RENAME COLUMN nuvemfiscal_nfse_id            TO provider_nfse_id;

ALTER TABLE public.service_order_nfse
  RENAME COLUMN nuvemfiscal_status             TO provider_status;

ALTER TABLE public.service_order_nfse
  RENAME COLUMN nuvemfiscal_numero             TO nfse_number;

ALTER TABLE public.service_order_nfse
  RENAME COLUMN nuvemfiscal_codigo_verificacao TO verification_code;

ALTER TABLE public.service_order_nfse
  RENAME COLUMN nuvemfiscal_data_emissao       TO issued_at;

ALTER TABLE public.service_order_nfse
  RENAME COLUMN nuvemfiscal_ambiente           TO environment;

ALTER TABLE public.service_order_nfse
  RENAME COLUMN nuvemfiscal_referencia         TO provider_reference;

ALTER TABLE public.service_order_nfse
  RENAME COLUMN nuvemfiscal_dps_serie          TO dps_series;

ALTER TABLE public.service_order_nfse
  RENAME COLUMN nuvemfiscal_dps_numero         TO dps_number;

ALTER TABLE public.service_order_nfse
  RENAME COLUMN nuvemfiscal_mensagens_json     TO messages_json;

ALTER TABLE public.service_order_nfse
  RENAME COLUMN nuvemfiscal_cancelamento_json  TO cancellation_json;

ALTER TABLE public.service_order_nfse
  RENAME COLUMN nuvemfiscal_response_json      TO response_json;

ALTER TABLE public.service_order_nfse
  RENAME COLUMN nuvemfiscal_link_url           TO document_url;

-- ---------------------------------------------------------------------------
-- REPLACE INDEXES
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS idx_service_order_nfse_nuvemfiscal_id;

CREATE INDEX idx_service_order_nfse_provider_nfse_id
  ON public.service_order_nfse (provider_nfse_id)
  WHERE provider_nfse_id IS NOT NULL;

-- Index on provider_reference — used heavily for API lookups by ref
CREATE INDEX idx_service_order_nfse_provider_reference
  ON public.service_order_nfse (provider_reference)
  WHERE provider_reference IS NOT NULL;

-- ---------------------------------------------------------------------------
-- UPDATE COLUMN COMMENTS
-- ---------------------------------------------------------------------------
COMMENT ON COLUMN public.service_order_nfse.provider_nfse_id IS
  'NFS-e ID assigned by the fiscal provider (Focus NFe).';
COMMENT ON COLUMN public.service_order_nfse.provider_status IS
  'Raw status string returned by the fiscal provider (e.g. processando_autorizacao, autorizado, cancelado, erro_autorizacao).';
COMMENT ON COLUMN public.service_order_nfse.nfse_number IS
  'NFS-e sequential number assigned by the municipality.';
COMMENT ON COLUMN public.service_order_nfse.verification_code IS
  'Verification code issued by the municipal tax authority for NFS-e validation.';
COMMENT ON COLUMN public.service_order_nfse.issued_at IS
  'Emission date as returned by the fiscal provider (stored as text to preserve original format).';
COMMENT ON COLUMN public.service_order_nfse.environment IS
  'Fiscal provider environment: ''homologacao'' (sandbox) or ''producao''.';
COMMENT ON COLUMN public.service_order_nfse.provider_reference IS
  'Reference/identifier sent to the fiscal provider API (maps to the ''ref'' field in Focus NFe).';
COMMENT ON COLUMN public.service_order_nfse.dps_series IS
  'DPS (Documento Padrão de Serviço) series — part of the national NFS-e standard.';
COMMENT ON COLUMN public.service_order_nfse.dps_number IS
  'DPS sequential number.';
COMMENT ON COLUMN public.service_order_nfse.messages_json IS
  'Messages/warnings returned by the fiscal provider (JSON array).';
COMMENT ON COLUMN public.service_order_nfse.cancellation_json IS
  'Structured cancellation data from the fiscal provider; populated only when status = ''canceled''.';
COMMENT ON COLUMN public.service_order_nfse.response_json IS
  'Raw fiscal provider API response stored for debugging and reprocessing.';
COMMENT ON COLUMN public.service_order_nfse.document_url IS
  'Public URL to view or download the NFS-e document from the municipal portal or fiscal provider.';

COMMENT ON TABLE public.service_order_nfse IS
  'NFS-e (Nota Fiscal de Serviços Eletrônica) records linked to service orders. '
  'One service order may have multiple NFS-e rows (e.g. reissues after cancellation); '
  'the currently active one is referenced via service_orders.active_nfse_id.';

COMMENT ON COLUMN public.service_order_nfse.payload_json IS
  'Complete NFS-e payload sent to the fiscal provider, preserved for reprocessing and auditing.';
