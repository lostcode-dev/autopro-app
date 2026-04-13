-- =============================================================================
-- Migration: 20240101000034_create_service_order_nfse
-- Description: Creates the service_order_nfse table, which stores NFS-e (Nota
--              Fiscal de Serviços Eletrônica — service invoice) records linked
--              to service orders. After table creation, the deferred FK from
--              service_orders (active_nfse_id) is also added.
--
-- NOTE on varchar(100) for FKs: this note is retained for historical context,
-- but service_order_id and organization_id are now uuid to match the PKs of
-- their referenced tables.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- TABLE
-- ---------------------------------------------------------------------------
CREATE TABLE public.service_order_nfse (
  -- Primary key
  id                                  uuid          NOT NULL DEFAULT gen_random_uuid(),

  -- Relationships
  service_order_id                    uuid          NOT NULL
    REFERENCES public.service_orders(id) ON DELETE CASCADE,
  organization_id                     uuid          NOT NULL
    REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- NFS-e lifecycle status
  status                              varchar(20)   NOT NULL
    CHECK (status IN ('draft', 'issued', 'error', 'canceled')),

  -- Human-readable reference
  service_order_number                varchar(50),  -- Display number of the linked service order

  -- Payload & snapshots (stored as JSON text for immutable audit trail)
  payload_json                        text,         -- NFS-e payload sent to Nuvem Fiscal
  os_snapshot_json                    text,         -- Service order snapshot at time of emission
  client_snapshot_json                text,         -- Client snapshot at time of emission
  vehicle_snapshot_json               text,         -- Vehicle snapshot at time of emission

  -- Nuvem Fiscal response fields
  nuvemfiscal_nfse_id                 varchar(100), -- NFS-e ID returned by Nuvem Fiscal
  nuvemfiscal_status                  varchar(50),  -- Status string from Nuvem Fiscal
  nuvemfiscal_numero                  varchar(20),  -- NFS-e sequential number
  nuvemfiscal_codigo_verificacao      varchar(50),  -- Verification code for the NFS-e
  nuvemfiscal_data_emissao            varchar(50),  -- Emission date as returned (string to preserve format)
  nuvemfiscal_ambiente                varchar(20),  -- 'homologacao' (sandbox) or 'producao'
  nuvemfiscal_referencia              varchar(100), -- Reference/identifier used in the API request
  nuvemfiscal_dps_serie               varchar(10),  -- DPS (Documento Padrão de Serviço) series
  nuvemfiscal_dps_numero              varchar(20),  -- DPS sequential number
  nuvemfiscal_mensagens_json          text,         -- Messages/warnings returned by Nuvem Fiscal
  nuvemfiscal_cancelamento_json       text,         -- Cancellation details when status = 'canceled'
  nuvemfiscal_response_json           text,         -- Raw API response for debugging
  nuvemfiscal_link_url                varchar(500), -- Public link to view/download the NFS-e

  -- Error tracking
  last_error_message                  text,
  last_error_json                     text,         -- Structured error payload
  last_error_at                       timestamptz,

  -- NFS-e PDF
  pdf_base64                          text,         -- Base-64 encoded NFS-e PDF
  pdf_file_name                       varchar(200),
  pdf_content_type                    varchar(50),  -- e.g. 'application/pdf'

  -- Audit columns
  created_at                          timestamptz   NOT NULL DEFAULT now(),
  created_by                          varchar(200),
  updated_at                          timestamptz   NOT NULL DEFAULT now(),
  updated_by                          varchar(200),
  deleted_at                          timestamptz,
  deleted_by                          varchar(200),

  -- Constraints
  CONSTRAINT service_order_nfse_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE  public.service_order_nfse IS
  'NFS-e (Nota Fiscal de Serviços Eletrônica) records linked to service orders. '
  'One service order may have multiple NFS-e rows (e.g. reissues after cancellation); '
  'the currently active one is referenced via service_orders.active_nfse_id.';
COMMENT ON COLUMN public.service_order_nfse.service_order_id IS
  'References service_orders.id (uuid). Cascade-deletes the NFS-e when the parent service order is deleted.';
COMMENT ON COLUMN public.service_order_nfse.status IS
  'NFS-e lifecycle status: draft | issued | error | canceled.';
COMMENT ON COLUMN public.service_order_nfse.payload_json IS
  'Complete NFS-e payload sent to Nuvem Fiscal, preserved for reprocessing and auditing.';
COMMENT ON COLUMN public.service_order_nfse.os_snapshot_json IS
  'Immutable snapshot of the service order at the moment of NFS-e emission.';
COMMENT ON COLUMN public.service_order_nfse.nuvemfiscal_ambiente IS
  'Nuvem Fiscal environment: ''homologacao'' (sandbox) or ''producao''.';
COMMENT ON COLUMN public.service_order_nfse.nuvemfiscal_codigo_verificacao IS
  'Verification code issued by the municipal tax authority for NFS-e validation.';
COMMENT ON COLUMN public.service_order_nfse.nuvemfiscal_dps_serie IS
  'DPS (Documento Padrão de Serviço) series — part of the national NFS-e standard (NFS-e Nacional).';
COMMENT ON COLUMN public.service_order_nfse.nuvemfiscal_cancelamento_json IS
  'Structured cancellation data returned by Nuvem Fiscal; populated only when status = ''canceled''.';
COMMENT ON COLUMN public.service_order_nfse.nuvemfiscal_link_url IS
  'Public URL to view or download the NFS-e document from the municipal portal or Nuvem Fiscal.';
COMMENT ON COLUMN public.service_order_nfse.pdf_base64 IS
  'Base-64 encoded NFS-e PDF for client download.';

-- ---------------------------------------------------------------------------
-- AUTO-UPDATE TRIGGER (updated_at)
-- ---------------------------------------------------------------------------
CREATE TRIGGER trg_service_order_nfse_updated_at
  BEFORE UPDATE ON public.service_order_nfse
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- INDEXES
-- ---------------------------------------------------------------------------

-- Partial index for org-scoped queries on active (non-deleted) rows
CREATE INDEX idx_service_order_nfse_org_active
  ON public.service_order_nfse (organization_id)
  WHERE deleted_at IS NULL;

-- FK: service_order_id — heavily used in joins
CREATE INDEX idx_service_order_nfse_service_order_id
  ON public.service_order_nfse (service_order_id);

-- Composite: filter by org + status (e.g. list all issued NFS-es for an org)
CREATE INDEX idx_service_order_nfse_org_status
  ON public.service_order_nfse (organization_id, status)
  WHERE deleted_at IS NULL;

-- Nuvem Fiscal NFS-e ID lookup (non-null rows only)
CREATE INDEX idx_service_order_nfse_nuvemfiscal_id
  ON public.service_order_nfse (nuvemfiscal_nfse_id)
  WHERE nuvemfiscal_nfse_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- DEFERRED FK: add active_nfse_id back-reference on service_orders
-- This FK could not be added during service_orders creation because
-- service_order_nfse did not exist yet.
-- ---------------------------------------------------------------------------
ALTER TABLE public.service_orders
  ADD CONSTRAINT fk_service_orders_active_nfse
  FOREIGN KEY (active_nfse_id)
  REFERENCES public.service_order_nfse(id)
  ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- ROW-LEVEL SECURITY
-- ---------------------------------------------------------------------------
ALTER TABLE public.service_order_nfse ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_order_nfse_select_same_org"
  ON public.service_order_nfse
  FOR SELECT TO authenticated
  USING (organization_id = public.current_user_organization_id());

CREATE POLICY "service_order_nfse_insert_same_org"
  ON public.service_order_nfse
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.current_user_organization_id());

CREATE POLICY "service_order_nfse_update_same_org"
  ON public.service_order_nfse
  FOR UPDATE TO authenticated
  USING  (organization_id = public.current_user_organization_id())
  WITH CHECK (organization_id = public.current_user_organization_id());

CREATE POLICY "service_order_nfse_delete_same_org"
  ON public.service_order_nfse
  FOR DELETE TO authenticated
  USING (organization_id = public.current_user_organization_id());
