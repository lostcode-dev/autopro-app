-- =============================================================================
-- Migration: 20240101000021_create_financial_transactions
-- Description: Creates the financial_transactions table — the central ledger
--              for all monetary movements (income, expense, transfers).
--              Also resolves circular FKs from employee_financial_records
--              and service_order_installments.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- TABLE: financial_transactions
-- -----------------------------------------------------------------------------
CREATE TABLE public.financial_transactions (
    -- Primary key
    id                              uuid            NOT NULL DEFAULT gen_random_uuid(),

    -- Tenant scoping
    organization_id                 uuid            NOT NULL,

    -- Core fields
    description                     varchar(300)    NOT NULL,
    amount                          numeric(15, 2)  NOT NULL,
    due_date                        date            NOT NULL,
    type                            varchar(10)     NOT NULL,
    status                          varchar(20)     NOT NULL DEFAULT 'pending',
    category                        varchar(30)     NOT NULL,

    -- Recurrence
    recurrence                      varchar(20),
    recurrence_end_date             date,
    parent_recurrence_id            uuid,

    -- Installment tracking
    is_installment                  boolean         NOT NULL DEFAULT false,
    installment_count               int,
    current_installment             int,
    parent_transaction_id           uuid,

    -- Related entities
    employee_financial_record_id    uuid,
    bank_account_id                 uuid,
    service_order_installment_id    uuid,

    -- purchase_id FK is completed in migration 23 once purchases table exists
    purchase_id                     uuid,

    -- Free-text notes
    notes                           text,

    -- Audit columns
    created_at                      timestamptz     NOT NULL DEFAULT now(),
    created_by                      varchar(200),
    updated_at                      timestamptz     NOT NULL DEFAULT now(),
    updated_by                      varchar(200),
    deleted_at                      timestamptz,
    deleted_by                      varchar(200),

    -- Constraints
    CONSTRAINT financial_transactions_pkey
        PRIMARY KEY (id),

    CONSTRAINT financial_transactions_organization_fk
        FOREIGN KEY (organization_id)
        REFERENCES public.organizations (id)
        ON DELETE CASCADE,

    CONSTRAINT financial_transactions_bank_account_fk
        FOREIGN KEY (bank_account_id)
        REFERENCES public.bank_accounts (id)
        ON DELETE SET NULL,

    CONSTRAINT financial_transactions_employee_financial_record_fk
        FOREIGN KEY (employee_financial_record_id)
        REFERENCES public.employee_financial_records (id)
        ON DELETE SET NULL,

    CONSTRAINT financial_transactions_service_order_installment_fk
        FOREIGN KEY (service_order_installment_id)
        REFERENCES public.service_order_installments (id)
        ON DELETE SET NULL,

    -- Self-referencing FKs for recurrence chains and installment families
    CONSTRAINT financial_transactions_parent_recurrence_fk
        FOREIGN KEY (parent_recurrence_id)
        REFERENCES public.financial_transactions (id)
        ON DELETE SET NULL,

    CONSTRAINT financial_transactions_parent_transaction_fk
        FOREIGN KEY (parent_transaction_id)
        REFERENCES public.financial_transactions (id)
        ON DELETE SET NULL,

    -- Domain checks
    CONSTRAINT financial_transactions_type_check
        CHECK (type IN ('income', 'expense', 'transfer_in', 'transfer_out')),

    CONSTRAINT financial_transactions_status_check
        CHECK (status IN ('paid', 'pending', 'cancelled')),

    CONSTRAINT financial_transactions_category_check
        CHECK (category IN ('sales', 'services', 'rent', 'salaries', 'suppliers', 'taxes', 'marketing', 'other')),

    CONSTRAINT financial_transactions_recurrence_check
        CHECK (recurrence IS NULL OR recurrence IN ('non_recurring', 'monthly', 'annual'))
);

COMMENT ON TABLE public.financial_transactions IS
    'Central ledger for all financial movements: income, expenses, and bank transfers. Supports recurrence and installment families.';

COMMENT ON COLUMN public.financial_transactions.type IS
    'income | expense | transfer_in | transfer_out';

COMMENT ON COLUMN public.financial_transactions.status IS
    'paid | pending | cancelled';

COMMENT ON COLUMN public.financial_transactions.category IS
    'sales | services | rent | salaries | suppliers | taxes | marketing | other';

COMMENT ON COLUMN public.financial_transactions.recurrence IS
    'non_recurring | monthly | annual — NULL means no recurrence metadata stored.';

COMMENT ON COLUMN public.financial_transactions.parent_recurrence_id IS
    'Points to the originating transaction that seeded a recurring series.';

COMMENT ON COLUMN public.financial_transactions.parent_transaction_id IS
    'Points to the first installment transaction when is_installment = true.';

COMMENT ON COLUMN public.financial_transactions.purchase_id IS
    'FK to purchases.id — constraint fk_ft_purchase added in migration 20240101000023 after purchases table is created.';

-- -----------------------------------------------------------------------------
-- INDEXES
-- -----------------------------------------------------------------------------

-- Tenant isolation
CREATE INDEX idx_financial_transactions_org_id
    ON public.financial_transactions (organization_id)
    WHERE deleted_at IS NULL;

-- Bank account lookups
CREATE INDEX idx_financial_transactions_bank_account_id
    ON public.financial_transactions (bank_account_id);

-- Employee financial record link
CREATE INDEX idx_financial_transactions_employee_financial_record_id
    ON public.financial_transactions (employee_financial_record_id);

-- Service order installment link
CREATE INDEX idx_financial_transactions_service_order_installment_id
    ON public.financial_transactions (service_order_installment_id);

-- Recurrence chain traversal
CREATE INDEX idx_financial_transactions_parent_recurrence_id
    ON public.financial_transactions (parent_recurrence_id);

-- Installment family traversal
CREATE INDEX idx_financial_transactions_parent_transaction_id
    ON public.financial_transactions (parent_transaction_id);

-- Org + type (e.g., "all expenses for org X")
CREATE INDEX idx_financial_transactions_org_type
    ON public.financial_transactions (organization_id, type)
    WHERE deleted_at IS NULL;

-- Org + status (e.g., "all pending for org X")
CREATE INDEX idx_financial_transactions_org_status
    ON public.financial_transactions (organization_id, status)
    WHERE deleted_at IS NULL;

-- Org + due_date for cash-flow calendars
CREATE INDEX idx_financial_transactions_org_due_date
    ON public.financial_transactions (organization_id, due_date)
    WHERE deleted_at IS NULL;

-- Org + category for reporting dashboards
CREATE INDEX idx_financial_transactions_org_category
    ON public.financial_transactions (organization_id, category)
    WHERE deleted_at IS NULL;

-- -----------------------------------------------------------------------------
-- AUTO-UPDATE TRIGGER: updated_at
-- -----------------------------------------------------------------------------
CREATE TRIGGER trg_financial_transactions_updated_at
    BEFORE UPDATE ON public.financial_transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- -----------------------------------------------------------------------------
ALTER TABLE public.financial_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "financial_transactions_select_same_org"
    ON public.financial_transactions
    FOR SELECT
    TO authenticated
    USING (organization_id = public.current_user_organization_id());

CREATE POLICY "financial_transactions_insert_same_org"
    ON public.financial_transactions
    FOR INSERT
    TO authenticated
    WITH CHECK (organization_id = public.current_user_organization_id());

CREATE POLICY "financial_transactions_update_same_org"
    ON public.financial_transactions
    FOR UPDATE
    TO authenticated
    USING (organization_id = public.current_user_organization_id())
    WITH CHECK (organization_id = public.current_user_organization_id());

CREATE POLICY "financial_transactions_delete_same_org"
    ON public.financial_transactions
    FOR DELETE
    TO authenticated
    USING (organization_id = public.current_user_organization_id());

-- -----------------------------------------------------------------------------
-- DEFERRED FK: employee_financial_records → financial_transactions
-- Resolves the circular dependency introduced in migration 20240101000020.
-- employee_financial_records was created first, so financial_transaction_id
-- was left as a plain uuid column — we close the loop here.
-- -----------------------------------------------------------------------------
ALTER TABLE public.employee_financial_records
    ADD CONSTRAINT fk_efr_financial_transaction
    FOREIGN KEY (financial_transaction_id)
    REFERENCES public.financial_transactions (id)
    ON DELETE SET NULL;

COMMENT ON CONSTRAINT fk_efr_financial_transaction
    ON public.employee_financial_records IS
    'Deferred FK added here (migration 21) to break the circular dependency with financial_transactions.';

-- -----------------------------------------------------------------------------
-- DEFERRED FK: service_order_installments → financial_transactions
-- service_order_installments was created before financial_transactions;
-- we add the FK now that the target table exists.
-- -----------------------------------------------------------------------------
ALTER TABLE public.service_order_installments
    ADD CONSTRAINT fk_soi_financial_transaction
    FOREIGN KEY (financial_transaction_id)
    REFERENCES public.financial_transactions (id)
    ON DELETE SET NULL;

COMMENT ON CONSTRAINT fk_soi_financial_transaction
    ON public.service_order_installments IS
    'Deferred FK added here (migration 21) — service_order_installments was created before financial_transactions.';
