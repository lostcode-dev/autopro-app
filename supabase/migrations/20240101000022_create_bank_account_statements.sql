-- =============================================================================
-- Migration: 20240101000022_create_bank_account_statements
-- Description: Creates the bank_account_statements table, which records every
--              debit/credit event on a bank account and maintains a running
--              balance (previous_balance → new_balance) for audit purposes.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- TABLE: bank_account_statements
-- -----------------------------------------------------------------------------
CREATE TABLE public.bank_account_statements (
    -- Primary key
    id                          uuid            NOT NULL DEFAULT gen_random_uuid(),

    -- Tenant scoping
    organization_id             uuid            NOT NULL,

    -- Bank account this statement line belongs to
    bank_account_id             uuid            NOT NULL,

    -- Transaction details
    transaction_date            date            NOT NULL,
    description                 varchar(300)    NOT NULL,
    transaction_type            varchar(30)     NOT NULL,
    amount                      numeric(15, 2)  NOT NULL,

    -- Running balance snapshot
    previous_balance            numeric(15, 2)  NOT NULL,
    new_balance                 numeric(15, 2)  NOT NULL,

    -- Optional link to the originating financial transaction
    financial_transaction_id    uuid,

    -- Free-text notes
    notes                       text,

    -- Audit columns
    created_at                  timestamptz     NOT NULL DEFAULT now(),
    created_by                  varchar(200),
    updated_at                  timestamptz     NOT NULL DEFAULT now(),
    updated_by                  varchar(200),
    deleted_at                  timestamptz,
    deleted_by                  varchar(200),

    -- Constraints
    CONSTRAINT bank_account_statements_pkey
        PRIMARY KEY (id),

    CONSTRAINT bank_account_statements_organization_fk
        FOREIGN KEY (organization_id)
        REFERENCES public.organizations (id)
        ON DELETE CASCADE,

    CONSTRAINT bank_account_statements_bank_account_fk
        FOREIGN KEY (bank_account_id)
        REFERENCES public.bank_accounts (id)
        ON DELETE CASCADE,

    CONSTRAINT bank_account_statements_financial_transaction_fk
        FOREIGN KEY (financial_transaction_id)
        REFERENCES public.financial_transactions (id)
        ON DELETE SET NULL,

    CONSTRAINT bank_account_statements_transaction_type_check
        CHECK (transaction_type IN ('income', 'expense', 'transfer_in', 'transfer_out'))
);

COMMENT ON TABLE public.bank_account_statements IS
    'Immutable ledger of every credit/debit event on a bank account, with before/after balance snapshots for full audit trail.';

COMMENT ON COLUMN public.bank_account_statements.transaction_type IS
    'income | expense | transfer_in | transfer_out';

COMMENT ON COLUMN public.bank_account_statements.previous_balance IS
    'Account balance immediately before this transaction was applied.';

COMMENT ON COLUMN public.bank_account_statements.new_balance IS
    'Account balance immediately after this transaction was applied.';

COMMENT ON COLUMN public.bank_account_statements.financial_transaction_id IS
    'Optional back-reference to the financial_transactions entry that triggered this statement line.';

-- -----------------------------------------------------------------------------
-- INDEXES
-- -----------------------------------------------------------------------------

-- Tenant isolation
CREATE INDEX idx_bank_account_statements_org_id
    ON public.bank_account_statements (organization_id)
    WHERE deleted_at IS NULL;

-- Account-level lookups
CREATE INDEX idx_bank_account_statements_bank_account_id
    ON public.bank_account_statements (bank_account_id);

-- Financial transaction back-reference
CREATE INDEX idx_bank_account_statements_financial_transaction_id
    ON public.bank_account_statements (financial_transaction_id);

-- Account + date — chronological statement feed per account
CREATE INDEX idx_bank_account_statements_account_date
    ON public.bank_account_statements (bank_account_id, transaction_date)
    WHERE deleted_at IS NULL;

-- Org + date — cross-account date range queries / reporting
CREATE INDEX idx_bank_account_statements_org_date
    ON public.bank_account_statements (organization_id, transaction_date)
    WHERE deleted_at IS NULL;

-- -----------------------------------------------------------------------------
-- AUTO-UPDATE TRIGGER: updated_at
-- -----------------------------------------------------------------------------
CREATE TRIGGER trg_bank_account_statements_updated_at
    BEFORE UPDATE ON public.bank_account_statements
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- -----------------------------------------------------------------------------
ALTER TABLE public.bank_account_statements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bank_account_statements_select_same_org"
    ON public.bank_account_statements
    FOR SELECT
    TO authenticated
    USING (organization_id = public.current_user_organization_id());

CREATE POLICY "bank_account_statements_insert_same_org"
    ON public.bank_account_statements
    FOR INSERT
    TO authenticated
    WITH CHECK (organization_id = public.current_user_organization_id());

CREATE POLICY "bank_account_statements_update_same_org"
    ON public.bank_account_statements
    FOR UPDATE
    TO authenticated
    USING (organization_id = public.current_user_organization_id())
    WITH CHECK (organization_id = public.current_user_organization_id());

CREATE POLICY "bank_account_statements_delete_same_org"
    ON public.bank_account_statements
    FOR DELETE
    TO authenticated
    USING (organization_id = public.current_user_organization_id());
