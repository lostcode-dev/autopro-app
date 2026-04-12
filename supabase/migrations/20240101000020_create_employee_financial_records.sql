-- =============================================================================
-- Migration: 20240101000020_create_employee_financial_records
-- Description: Creates the employee_financial_records table for tracking
--              salary, commission, advance, bonus, and discount entries
--              tied to employees within a multi-tenant organization.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- TABLE: employee_financial_records
-- -----------------------------------------------------------------------------
CREATE TABLE public.employee_financial_records (
    -- Primary key
    id                              uuid            NOT NULL DEFAULT gen_random_uuid(),

    -- Tenant scoping
    organization_id                 uuid            NOT NULL,

    -- Core relationships
    employee_id                     uuid            NOT NULL,
    service_order_id                uuid,
    service_order_installment_id    uuid,

    -- Deferred FK — financial_transaction_id is linked in migration 21
    -- once financial_transactions is created (circular dependency resolution)
    financial_transaction_id        uuid,

    -- Record classification
    record_type                     varchar(20)     NOT NULL,
    description                     varchar(300)    NOT NULL,
    amount                          numeric(15, 2)  NOT NULL,
    reference_date                  date            NOT NULL,
    status                          varchar(20)     NOT NULL DEFAULT 'pending',

    -- Payment tracking
    payment_date                    date,

    -- Audit columns
    created_at                      timestamptz     NOT NULL DEFAULT now(),
    created_by                      varchar(200),
    updated_at                      timestamptz     NOT NULL DEFAULT now(),
    updated_by                      varchar(200),
    deleted_at                      timestamptz,
    deleted_by                      varchar(200),

    -- Constraints
    CONSTRAINT employee_financial_records_pkey
        PRIMARY KEY (id),

    CONSTRAINT employee_financial_records_organization_fk
        FOREIGN KEY (organization_id)
        REFERENCES public.organizations (id)
        ON DELETE CASCADE,

    CONSTRAINT employee_financial_records_employee_fk
        FOREIGN KEY (employee_id)
        REFERENCES public.employees (id)
        ON DELETE CASCADE,

    CONSTRAINT employee_financial_records_service_order_fk
        FOREIGN KEY (service_order_id)
        REFERENCES public.service_orders (id)
        ON DELETE SET NULL,

    CONSTRAINT employee_financial_records_service_order_installment_fk
        FOREIGN KEY (service_order_installment_id)
        REFERENCES public.service_order_installments (id)
        ON DELETE SET NULL,

    CONSTRAINT employee_financial_records_record_type_check
        CHECK (record_type IN ('salary', 'commission', 'advance', 'bonus', 'discount')),

    CONSTRAINT employee_financial_records_status_check
        CHECK (status IN ('paid', 'pending'))
);

COMMENT ON TABLE public.employee_financial_records IS
    'Tracks individual financial events (salary, commission, advance, bonus, discount) per employee.';

COMMENT ON COLUMN public.employee_financial_records.record_type IS
    'salary | commission | advance | bonus | discount';

COMMENT ON COLUMN public.employee_financial_records.status IS
    'paid | pending';

COMMENT ON COLUMN public.employee_financial_records.financial_transaction_id IS
    'FK to financial_transactions.id — constraint added in migration 20240101000021 to resolve circular dependency.';

-- -----------------------------------------------------------------------------
-- INDEXES
-- -----------------------------------------------------------------------------

-- Tenant isolation — primary lookup for soft-delete-aware queries
CREATE INDEX idx_employee_financial_records_org_id
    ON public.employee_financial_records (organization_id)
    WHERE deleted_at IS NULL;

-- Employee lookups
CREATE INDEX idx_employee_financial_records_employee_id
    ON public.employee_financial_records (employee_id);

-- Service order linkage
CREATE INDEX idx_employee_financial_records_service_order_id
    ON public.employee_financial_records (service_order_id);

-- Org + status filtering (e.g., "show all pending for org X")
CREATE INDEX idx_employee_financial_records_org_status
    ON public.employee_financial_records (organization_id, status)
    WHERE deleted_at IS NULL;

-- Org + reference_date for period reports
CREATE INDEX idx_employee_financial_records_org_reference_date
    ON public.employee_financial_records (organization_id, reference_date)
    WHERE deleted_at IS NULL;

-- Employee + status (e.g., "show pending commissions for employee Y")
CREATE INDEX idx_employee_financial_records_employee_status
    ON public.employee_financial_records (employee_id, status)
    WHERE deleted_at IS NULL;

-- -----------------------------------------------------------------------------
-- AUTO-UPDATE TRIGGER: updated_at
-- -----------------------------------------------------------------------------
CREATE TRIGGER trg_employee_financial_records_updated_at
    BEFORE UPDATE ON public.employee_financial_records
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- -----------------------------------------------------------------------------
ALTER TABLE public.employee_financial_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "employee_financial_records_select_same_org"
    ON public.employee_financial_records
    FOR SELECT
    TO authenticated
    USING (organization_id = public.current_user_organization_id());

CREATE POLICY "employee_financial_records_insert_same_org"
    ON public.employee_financial_records
    FOR INSERT
    TO authenticated
    WITH CHECK (organization_id = public.current_user_organization_id());

CREATE POLICY "employee_financial_records_update_same_org"
    ON public.employee_financial_records
    FOR UPDATE
    TO authenticated
    USING (organization_id = public.current_user_organization_id())
    WITH CHECK (organization_id = public.current_user_organization_id());

CREATE POLICY "employee_financial_records_delete_same_org"
    ON public.employee_financial_records
    FOR DELETE
    TO authenticated
    USING (organization_id = public.current_user_organization_id());
