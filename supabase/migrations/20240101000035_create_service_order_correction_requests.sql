-- =============================================================================
-- Migration: 20240101000035_create_service_order_correction_requests.sql
-- Description: Creates the service_order_correction_requests table, which
--              tracks formal correction requests raised against service orders.
--              Supports a review workflow (pending → approved/rejected → completed).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- TABLE: service_order_correction_requests
-- ---------------------------------------------------------------------------
CREATE TABLE public.service_order_correction_requests (
  -- Primary key
  id                    uuid          NOT NULL DEFAULT gen_random_uuid(),

  -- Multi-tenancy scope
  organization_id       uuid          NOT NULL,

  -- Parent service order
  service_order_id      uuid          NOT NULL,

  -- Core correction request fields
  description           text          NOT NULL,
  status                varchar(20)   NOT NULL DEFAULT 'pending',

  -- Requester information
  requester_email       varchar(200)  NOT NULL,
  requester_name        varchar(200),

  -- Service order reference (denormalized for display/search convenience)
  service_order_number  varchar(50),

  -- Responsible employee assigned to handle the correction
  responsible_id        uuid,

  -- Approval tracking
  approved_by           varchar(200),
  approval_date         timestamptz,

  -- Completion tracking
  completion_date       timestamptz,
  resolution_notes      text,

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
  CONSTRAINT service_order_correction_requests_pkey
    PRIMARY KEY (id),

  CONSTRAINT service_order_correction_requests_status_check
    CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),

  CONSTRAINT service_order_correction_requests_organization_fk
    FOREIGN KEY (organization_id)
    REFERENCES public.organizations(id)
    ON DELETE CASCADE,

  CONSTRAINT service_order_correction_requests_service_order_fk
    FOREIGN KEY (service_order_id)
    REFERENCES public.service_orders(id)
    ON DELETE CASCADE,

  CONSTRAINT service_order_correction_requests_responsible_fk
    FOREIGN KEY (responsible_id)
    REFERENCES public.employees(id)
    ON DELETE SET NULL
);

-- ---------------------------------------------------------------------------
-- COMMENTS
-- ---------------------------------------------------------------------------
COMMENT ON TABLE public.service_order_correction_requests IS
  'Tracks formal correction requests raised against service orders, supporting a review workflow (pending → approved/rejected → completed).';

COMMENT ON COLUMN public.service_order_correction_requests.organization_id IS
  'Tenant scope — every row belongs to exactly one organization.';
COMMENT ON COLUMN public.service_order_correction_requests.service_order_id IS
  'The service order that this correction request targets.';
COMMENT ON COLUMN public.service_order_correction_requests.description IS
  'Detailed description of what needs to be corrected.';
COMMENT ON COLUMN public.service_order_correction_requests.status IS
  'Workflow state: pending → approved or rejected → completed.';
COMMENT ON COLUMN public.service_order_correction_requests.requester_email IS
  'Email of the person who raised the correction request.';
COMMENT ON COLUMN public.service_order_correction_requests.requester_name IS
  'Display name of the person who raised the correction request.';
COMMENT ON COLUMN public.service_order_correction_requests.service_order_number IS
  'Denormalized service order number for display/search without a join.';
COMMENT ON COLUMN public.service_order_correction_requests.responsible_id IS
  'Employee assigned to resolve this correction request.';
COMMENT ON COLUMN public.service_order_correction_requests.approved_by IS
  'Name or email of whoever approved or rejected this request.';
COMMENT ON COLUMN public.service_order_correction_requests.approval_date IS
  'Timestamp when the request was approved or rejected.';
COMMENT ON COLUMN public.service_order_correction_requests.completion_date IS
  'Timestamp when the correction was completed.';
COMMENT ON COLUMN public.service_order_correction_requests.resolution_notes IS
  'Free-text notes describing how the correction was resolved.';

-- ---------------------------------------------------------------------------
-- INDEXES
-- ---------------------------------------------------------------------------

-- Partial index for active (non-deleted) rows scoped to an organization
CREATE INDEX idx_socr_organization_id
  ON public.service_order_correction_requests (organization_id)
  WHERE deleted_at IS NULL;

-- FK index — avoids sequential scans on joins back to service_orders
CREATE INDEX idx_socr_service_order_id
  ON public.service_order_correction_requests (service_order_id);

-- FK index — supports lookups by assigned employee
CREATE INDEX idx_socr_responsible_id
  ON public.service_order_correction_requests (responsible_id);

-- Composite index for the most common filtered list query: org + status (active rows)
CREATE INDEX idx_socr_organization_status
  ON public.service_order_correction_requests (organization_id, status)
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- AUTO-UPDATE TRIGGER: keep updated_at current on every UPDATE
-- ---------------------------------------------------------------------------
CREATE TRIGGER trg_service_order_correction_requests_updated_at
  BEFORE UPDATE ON public.service_order_correction_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------
ALTER TABLE public.service_order_correction_requests ENABLE ROW LEVEL SECURITY;

-- SELECT: authenticated users see only rows that belong to their organization
CREATE POLICY "service_order_correction_requests_select_same_org"
  ON public.service_order_correction_requests
  FOR SELECT TO authenticated
  USING (organization_id = public.current_user_organization_id());

-- INSERT: authenticated users can only insert into their own organization
CREATE POLICY "service_order_correction_requests_insert_same_org"
  ON public.service_order_correction_requests
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.current_user_organization_id());

-- UPDATE: authenticated users can only update rows in their own organization
CREATE POLICY "service_order_correction_requests_update_same_org"
  ON public.service_order_correction_requests
  FOR UPDATE TO authenticated
  USING (organization_id = public.current_user_organization_id())
  WITH CHECK (organization_id = public.current_user_organization_id());

-- DELETE: authenticated users can only soft-delete rows in their own organization
CREATE POLICY "service_order_correction_requests_delete_same_org"
  ON public.service_order_correction_requests
  FOR DELETE TO authenticated
  USING (organization_id = public.current_user_organization_id());
