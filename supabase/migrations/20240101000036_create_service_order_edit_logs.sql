-- =============================================================================
-- Migration: 20240101000036_create_service_order_edit_logs.sql
-- Description: Creates the service_order_edit_logs table — an immutable,
--              append-only audit trail that records every change made to
--              service orders (creation, edits, corrections, cancellations).
--              No UPDATE or DELETE policies are granted to authenticated users.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- TABLE: service_order_edit_logs
-- ---------------------------------------------------------------------------
CREATE TABLE public.service_order_edit_logs (
  -- Primary key
  id                    uuid          NOT NULL DEFAULT gen_random_uuid(),

  -- Multi-tenancy scope
  organization_id       uuid          NOT NULL,

  -- Parent service order
  service_order_id      uuid          NOT NULL,

  -- What kind of change was recorded
  operation_type        varchar(20)   NOT NULL,

  -- Who performed the operation
  user_email            varchar(200)  NOT NULL,
  user_name             varchar(200),

  -- Denormalized service order reference for display without a join
  service_order_number  varchar(50),

  -- JSON snapshots of the row state before and after the change
  data_before           text,                 -- JSON snapshot before the change
  data_after            text,                 -- JSON snapshot after the change
  changed_fields        text,                 -- JSON array of field names that changed

  -- Optional link to the correction request that triggered this log entry
  correction_id         uuid,

  -- Free-text notes from the user or system about this change
  notes                 text,

  -- Audit columns
  created_at            timestamptz   NOT NULL DEFAULT now(),
  created_by            varchar(200),
  updated_at            timestamptz   NOT NULL DEFAULT now(),
  updated_by            varchar(200),
  deleted_at            timestamptz,
  deleted_by            varchar(200),

  -- -----------------------------------------------------------------
  -- Constraints
  -- -----------------------------------------------------------------
  CONSTRAINT service_order_edit_logs_pkey
    PRIMARY KEY (id),

  CONSTRAINT service_order_edit_logs_operation_type_check
    CHECK (operation_type IN ('creation', 'edit', 'correction', 'cancellation')),

  CONSTRAINT service_order_edit_logs_organization_fk
    FOREIGN KEY (organization_id)
    REFERENCES public.organizations(id)
    ON DELETE CASCADE,

  CONSTRAINT service_order_edit_logs_service_order_fk
    FOREIGN KEY (service_order_id)
    REFERENCES public.service_orders(id)
    ON DELETE CASCADE,

  CONSTRAINT service_order_edit_logs_correction_fk
    FOREIGN KEY (correction_id)
    REFERENCES public.service_order_correction_requests(id)
    ON DELETE SET NULL
);

-- ---------------------------------------------------------------------------
-- COMMENTS
-- ---------------------------------------------------------------------------
COMMENT ON TABLE public.service_order_edit_logs IS
  'Immutable, append-only audit trail of every change made to service orders. '
  'No UPDATE or DELETE is permitted for authenticated roles — entries are '
  'written exclusively by application logic.';

COMMENT ON COLUMN public.service_order_edit_logs.organization_id IS
  'Tenant scope — every log entry belongs to exactly one organization.';
COMMENT ON COLUMN public.service_order_edit_logs.service_order_id IS
  'The service order that was modified.';
COMMENT ON COLUMN public.service_order_edit_logs.operation_type IS
  'Type of operation: creation | edit | correction | cancellation.';
COMMENT ON COLUMN public.service_order_edit_logs.user_email IS
  'Email of the user who performed the operation.';
COMMENT ON COLUMN public.service_order_edit_logs.user_name IS
  'Display name of the user who performed the operation.';
COMMENT ON COLUMN public.service_order_edit_logs.service_order_number IS
  'Denormalized service order number for display/search without a join.';
COMMENT ON COLUMN public.service_order_edit_logs.data_before IS
  'JSON snapshot of the service order row state before the change. NULL for creation events.';
COMMENT ON COLUMN public.service_order_edit_logs.data_after IS
  'JSON snapshot of the service order row state after the change. NULL for cancellation events.';
COMMENT ON COLUMN public.service_order_edit_logs.changed_fields IS
  'JSON array of field names that were modified in this operation.';
COMMENT ON COLUMN public.service_order_edit_logs.correction_id IS
  'Optional reference to the correction request that triggered this log entry.';
COMMENT ON COLUMN public.service_order_edit_logs.notes IS
  'Free-text notes from the user or system explaining the change.';

-- ---------------------------------------------------------------------------
-- INDEXES
-- ---------------------------------------------------------------------------

-- Partial index for active (non-deleted) rows scoped to an organization
CREATE INDEX idx_soel_organization_id
  ON public.service_order_edit_logs (organization_id)
  WHERE deleted_at IS NULL;

-- FK index — supports lookups of all log entries for a given service order
CREATE INDEX idx_soel_service_order_id
  ON public.service_order_edit_logs (service_order_id);

-- Composite index for filtering logs by org + operation type (active rows)
CREATE INDEX idx_soel_organization_operation_type
  ON public.service_order_edit_logs (organization_id, operation_type)
  WHERE deleted_at IS NULL;

-- Composite index for chronological audit queries within an organization
CREATE INDEX idx_soel_organization_created_at
  ON public.service_order_edit_logs (organization_id, created_at)
  WHERE deleted_at IS NULL;

-- FK index — allows finding all log entries linked to a correction request
CREATE INDEX idx_soel_correction_id
  ON public.service_order_edit_logs (correction_id);

-- ---------------------------------------------------------------------------
-- AUTO-UPDATE TRIGGER: keep updated_at current on every UPDATE
-- (retained for operational consistency even though app logic should never
--  UPDATE these rows — guards against accidental or admin-level changes)
-- ---------------------------------------------------------------------------
CREATE TRIGGER trg_service_order_edit_logs_updated_at
  BEFORE UPDATE ON public.service_order_edit_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- This is an append-only audit log.
-- Authenticated users may SELECT and INSERT only.
-- UPDATE and DELETE are intentionally omitted for authenticated roles.
-- ---------------------------------------------------------------------------
ALTER TABLE public.service_order_edit_logs ENABLE ROW LEVEL SECURITY;

-- SELECT: authenticated users see only log entries from their own organization
CREATE POLICY "service_order_edit_logs_select_same_org"
  ON public.service_order_edit_logs
  FOR SELECT TO authenticated
  USING (organization_id = public.current_user_organization_id());

-- INSERT: application logic writes audit entries scoped to the caller's org
CREATE POLICY "service_order_edit_logs_insert_same_org"
  ON public.service_order_edit_logs
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.current_user_organization_id());

-- NOTE: No UPDATE or DELETE policies for authenticated users.
--       Entries in this table are permanent records. Any administrative
--       corrections must be performed by the service_role directly.
