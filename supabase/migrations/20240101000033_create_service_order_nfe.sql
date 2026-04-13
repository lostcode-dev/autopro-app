-- =============================================================================
-- Migration: 20240101000033_create_service_order_nfe
-- Description: Creates the service_order_nfe table, which stores NF-e (Nota
--              Fiscal Eletrônica — product invoice) records linked to service
--              orders. After table creation, the deferred FK from service_orders
--              (active_nfe_id) is also added.
--
-- NOTE on varchar(100) for FKs: this note is retained for historical context,
-- but service_order_id and organization_id are now uuid to match the PKs of
-- their referenced tables.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- TABLE
-- ---------------------------------------------------------------------------
CREATE TABLE public.service_order_nfe (
  -- Primary key
  id                              uuid          NOT NULL DEFAULT gen_random_uuid(),

  -- Relationships
  service_order_id                uuid          NOT NULL
    REFERENCES public.service_orders(id) ON DELETE CASCADE,
  organization_id                 uuid          NOT NULL
    REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- NF-e lifecycle status
  status                          varchar(20)   NOT NULL
    CHECK (status IN ('draft', 'issued', 'error', 'canceled')),

  -- Human-readable reference
  service_order_number            varchar(50),  -- Display number of the linked service order

  -- Payload & snapshots (stored as JSON text for immutable audit trail)
  payload_json                    text,         -- NF-e payload sent to Nuvem Fiscal
  os_snapshot_json                text,         -- Service order snapshot at time of emission
  client_snapshot_json            text,         -- Client snapshot at time of emission
  vehicle_snapshot_json           text,         -- Vehicle snapshot at time of emission

  -- Nuvem Fiscal response fields
  nuvemfiscal_nfe_id              varchar(100), -- NF-e ID returned by Nuvem Fiscal
  nuvemfiscal_status              varchar(50),  -- Status string from Nuvem Fiscal
  nuvemfiscal_ambiente            varchar(20),  -- 'homologacao' (sandbox) or 'producao'
  nuvemfiscal_serie               varchar(10),  -- NF-e series
  nuvemfiscal_numero              varchar(20),  -- NF-e sequential number
  nuvemfiscal_valor_total         varchar(20),  -- Total value as returned by Nuvem Fiscal
  nuvemfiscal_chave_acesso        varchar(100), -- 44-digit access key
  nuvemfiscal_autorizacao_json    text,         -- Full authorization object from Nuvem Fiscal
  nuvemfiscal_response_json       text,         -- Raw API response for debugging

  -- Error tracking
  last_error_message              text,
  last_error_json                 text,         -- Structured error payload
  last_error_at                   timestamptz,

  -- DANFE (PDF representation of the NF-e)
  pdf_base64                      text,         -- Base-64 encoded DANFE PDF
  pdf_file_name                   varchar(200),
  pdf_content_type                varchar(50),  -- e.g. 'application/pdf'

  -- Audit columns
  created_at                      timestamptz   NOT NULL DEFAULT now(),
  created_by                      varchar(200),
  updated_at                      timestamptz   NOT NULL DEFAULT now(),
  updated_by                      varchar(200),
  deleted_at                      timestamptz,
  deleted_by                      varchar(200),

  -- Constraints
  CONSTRAINT service_order_nfe_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE  public.service_order_nfe IS
  'NF-e (Nota Fiscal Eletrônica de Produto) records linked to service orders. '
  'One service order may have multiple NF-e rows (e.g. reissues after cancellation); '
  'the currently active one is referenced via service_orders.active_nfe_id.';
COMMENT ON COLUMN public.service_order_nfe.service_order_id IS
  'References service_orders.id (uuid). Cascade-deletes the NF-e when the parent service order is deleted.';
COMMENT ON COLUMN public.service_order_nfe.status IS
  'NF-e lifecycle status: draft | issued | error | canceled.';
COMMENT ON COLUMN public.service_order_nfe.payload_json IS
  'Complete NF-e payload sent to Nuvem Fiscal, preserved for reprocessing and auditing.';
COMMENT ON COLUMN public.service_order_nfe.os_snapshot_json IS
  'Immutable snapshot of the service order at the moment of NF-e emission.';
COMMENT ON COLUMN public.service_order_nfe.nuvemfiscal_ambiente IS
  'Nuvem Fiscal environment: ''homologacao'' (sandbox) or ''producao''.';
COMMENT ON COLUMN public.service_order_nfe.nuvemfiscal_chave_acesso IS
  '44-digit NF-e access key (chave de acesso) used for government validation.';
COMMENT ON COLUMN public.service_order_nfe.pdf_base64 IS
  'Base-64 encoded DANFE (Documento Auxiliar da Nota Fiscal Eletrônica) PDF.';

-- ---------------------------------------------------------------------------
-- AUTO-UPDATE TRIGGER (updated_at)
-- ---------------------------------------------------------------------------
CREATE TRIGGER trg_service_order_nfe_updated_at
  BEFORE UPDATE ON public.service_order_nfe
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- INDEXES
-- ---------------------------------------------------------------------------

-- Partial index for org-scoped queries on active (non-deleted) rows
CREATE INDEX idx_service_order_nfe_org_active
  ON public.service_order_nfe (organization_id)
  WHERE deleted_at IS NULL;

-- FK: service_order_id — heavily used in joins
CREATE INDEX idx_service_order_nfe_service_order_id
  ON public.service_order_nfe (service_order_id);

-- Composite: filter by org + status (e.g. list all issued NF-es for an org)
CREATE INDEX idx_service_order_nfe_org_status
  ON public.service_order_nfe (organization_id, status)
  WHERE deleted_at IS NULL;

-- Nuvem Fiscal NF-e ID lookup (non-null rows only)
CREATE INDEX idx_service_order_nfe_nuvemfiscal_id
  ON public.service_order_nfe (nuvemfiscal_nfe_id)
  WHERE nuvemfiscal_nfe_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- DEFERRED FK: add active_nfe_id back-reference on service_orders
-- This FK could not be added during service_orders creation because
-- service_order_nfe did not exist yet.
-- ---------------------------------------------------------------------------
ALTER TABLE public.service_orders
  ADD CONSTRAINT fk_service_orders_active_nfe
  FOREIGN KEY (active_nfe_id)
  REFERENCES public.service_order_nfe(id)
  ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- ROW-LEVEL SECURITY
-- ---------------------------------------------------------------------------
ALTER TABLE public.service_order_nfe ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_order_nfe_select_same_org"
  ON public.service_order_nfe
  FOR SELECT TO authenticated
  USING (organization_id = public.current_user_organization_id());

CREATE POLICY "service_order_nfe_insert_same_org"
  ON public.service_order_nfe
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.current_user_organization_id());

CREATE POLICY "service_order_nfe_update_same_org"
  ON public.service_order_nfe
  FOR UPDATE TO authenticated
  USING  (organization_id = public.current_user_organization_id())
  WITH CHECK (organization_id = public.current_user_organization_id());

CREATE POLICY "service_order_nfe_delete_same_org"
  ON public.service_order_nfe
  FOR DELETE TO authenticated
  USING (organization_id = public.current_user_organization_id());
