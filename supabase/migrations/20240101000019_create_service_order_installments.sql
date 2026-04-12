-- =============================================================================
-- Migration: 20240101000019_create_service_order_installments.sql
-- Description: Creates the service_order_installments table for AutoPro
--              multi-tenant SaaS.
--              When a service order is paid in installments
--              (service_orders.is_installment = true), each scheduled payment
--              slice is represented as a row in this table.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- TABLE: service_order_installments
-- Breaks a service order's total amount into individual payment slices.
-- Each installment has its own due date, payment method, and lifecycle status.
--
-- FK note:
--   financial_transaction_id references the financial_transactions table, which
--   is created in migration 20240101000021. The FK constraint is intentionally
--   omitted here to avoid a forward dependency; it will be added by that later
--   migration. Application logic is responsible for referential integrity until
--   that constraint is in place.
-- -----------------------------------------------------------------------------
CREATE TABLE public.service_order_installments (
    -- Primary key
    id                          uuid            NOT NULL DEFAULT gen_random_uuid(),

    -- Tenant scoping
    organization_id             uuid            NOT NULL,

    -- Parent service order
    service_order_id            uuid            NOT NULL,

    -- Installment sequence (1-based, unique per service order)
    installment_number          int             NOT NULL,

    -- Amount due for this slice
    installment_amount          numeric(15, 2)  NOT NULL,

    -- Dates
    due_date                    date            NOT NULL,   -- when payment is due
    payment_date                date,                       -- when payment was actually received

    -- Lifecycle
    -- pending  → not yet paid
    -- paid     → payment confirmed
    -- overdue  → due date passed without payment
    status                      varchar(20)     NOT NULL DEFAULT 'pending'
                                    CHECK (status IN ('pending', 'paid', 'overdue')),

    -- How this installment was / will be settled
    payment_method              varchar(30)
                                    CHECK (payment_method IN (
                                        'pix',
                                        'cash',
                                        'credit_card',
                                        'debit_card',
                                        'check',
                                        'bank_slip',
                                        'transfer'
                                    )),

    -- Soft reference to the corresponding financial transaction record.
    -- FK constraint will be added by migration 20240101000021 once the
    -- financial_transactions table exists.
    financial_transaction_id    uuid,

    -- Additional notes (e.g. cheque number, reference code)
    notes                       text,

    -- Audit columns
    created_at                  timestamptz     NOT NULL DEFAULT now(),
    created_by                  varchar(200),
    updated_at                  timestamptz     NOT NULL DEFAULT now(),
    updated_by                  varchar(200),
    deleted_at                  timestamptz,
    deleted_by                  varchar(200),

    -- Constraints
    CONSTRAINT service_order_installments_pkey
        PRIMARY KEY (id),

    CONSTRAINT service_order_installments_organization_id_fkey
        FOREIGN KEY (organization_id)
        REFERENCES public.organizations (id)
        ON DELETE CASCADE,

    CONSTRAINT service_order_installments_service_order_id_fkey
        FOREIGN KEY (service_order_id)
        REFERENCES public.service_orders (id)
        ON DELETE CASCADE,  -- remove installments when the parent order is hard-deleted

    -- An installment number must be unique within a service order
    CONSTRAINT service_order_installments_service_order_id_number_key
        UNIQUE (service_order_id, installment_number)
);

-- -----------------------------------------------------------------------------
-- COMMENTS
-- -----------------------------------------------------------------------------
COMMENT ON TABLE  public.service_order_installments IS 'Individual payment slices for service orders paid in installments. Created when service_orders.is_installment = true.';
COMMENT ON COLUMN public.service_order_installments.installment_number      IS '1-based sequence number of this payment slice within its parent service order.';
COMMENT ON COLUMN public.service_order_installments.due_date                IS 'Date by which this installment must be paid.';
COMMENT ON COLUMN public.service_order_installments.payment_date            IS 'Date the payment was actually received. NULL while status is pending or overdue.';
COMMENT ON COLUMN public.service_order_installments.financial_transaction_id IS 'Soft reference to the financial_transactions record generated when this installment is settled. FK constraint added by migration 20240101000021.';

-- -----------------------------------------------------------------------------
-- INDEXES
-- -----------------------------------------------------------------------------

-- Tenant filter — base scan for all installment queries
CREATE INDEX idx_service_order_installments_organization_id
    ON public.service_order_installments (organization_id)
    WHERE deleted_at IS NULL;

-- FK index for fetching all installments of a given service order
CREATE INDEX idx_service_order_installments_service_order_id
    ON public.service_order_installments (service_order_id);

-- Accounts receivable board: overdue / pending installments per org
CREATE INDEX idx_service_order_installments_organization_id_status
    ON public.service_order_installments (organization_id, status)
    WHERE deleted_at IS NULL;

-- Cash-flow forecast: installments due within a date range
CREATE INDEX idx_service_order_installments_organization_id_due_date
    ON public.service_order_installments (organization_id, due_date)
    WHERE deleted_at IS NULL;

-- -----------------------------------------------------------------------------
-- AUTO-UPDATE TRIGGER: keep updated_at current on every row modification
-- -----------------------------------------------------------------------------
CREATE TRIGGER trg_service_order_installments_updated_at
    BEFORE UPDATE ON public.service_order_installments
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- -----------------------------------------------------------------------------
ALTER TABLE public.service_order_installments ENABLE ROW LEVEL SECURITY;

-- SELECT: only rows belonging to the authenticated user's organization
CREATE POLICY "service_order_installments_select_same_org"
    ON public.service_order_installments
    FOR SELECT
    TO authenticated
    USING (organization_id = public.current_user_organization_id());

-- INSERT: enforce org scoping at write time
CREATE POLICY "service_order_installments_insert_same_org"
    ON public.service_order_installments
    FOR INSERT
    TO authenticated
    WITH CHECK (organization_id = public.current_user_organization_id());

-- UPDATE: enforce org scoping on both the existing row and the new values
CREATE POLICY "service_order_installments_update_same_org"
    ON public.service_order_installments
    FOR UPDATE
    TO authenticated
    USING  (organization_id = public.current_user_organization_id())
    WITH CHECK (organization_id = public.current_user_organization_id());

-- DELETE: soft deletes are preferred, but hard-delete is also org-scoped
CREATE POLICY "service_order_installments_delete_same_org"
    ON public.service_order_installments
    FOR DELETE
    TO authenticated
    USING (organization_id = public.current_user_organization_id());
