-- =============================================================================
-- Migration: 20240101000053_add_payment_compatibility_fields
-- Description: Adds compatibility columns used by the current payment flow
--              without breaking older code paths. This keeps both the original
--              schema names and the newer application-facing names in sync.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- financial_transactions: add payment metadata and service-order linkage
-- ----------------------------------------------------------------------------
ALTER TABLE public.financial_transactions
    ADD COLUMN IF NOT EXISTS service_order_id uuid,
    ADD COLUMN IF NOT EXISTS payment_method varchar(30),
    ADD COLUMN IF NOT EXISTS payment_terminal_id uuid;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'financial_transactions_service_order_fk'
    ) THEN
        ALTER TABLE public.financial_transactions
            ADD CONSTRAINT financial_transactions_service_order_fk
            FOREIGN KEY (service_order_id)
            REFERENCES public.service_orders (id)
            ON DELETE SET NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'financial_transactions_payment_terminal_fk'
    ) THEN
        ALTER TABLE public.financial_transactions
            ADD CONSTRAINT financial_transactions_payment_terminal_fk
            FOREIGN KEY (payment_terminal_id)
            REFERENCES public.payment_terminals (id)
            ON DELETE SET NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'financial_transactions_payment_method_check'
    ) THEN
        ALTER TABLE public.financial_transactions
            ADD CONSTRAINT financial_transactions_payment_method_check
            CHECK (
                payment_method IS NULL OR payment_method IN (
                    'pix',
                    'cash',
                    'credit_card',
                    'debit_card',
                    'check',
                    'bank_slip',
                    'transfer'
                )
            );
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_financial_transactions_service_order_id
    ON public.financial_transactions (service_order_id)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_financial_transactions_payment_terminal_id
    ON public.financial_transactions (payment_terminal_id)
    WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_financial_transactions_payment_method
    ON public.financial_transactions (payment_method)
    WHERE deleted_at IS NULL;

COMMENT ON COLUMN public.financial_transactions.service_order_id IS
    'Optional link to the service order that originated the ledger entry.';

COMMENT ON COLUMN public.financial_transactions.payment_method IS
    'Payment method used on the originating operation when applicable.';

COMMENT ON COLUMN public.financial_transactions.payment_terminal_id IS
    'Optional payment terminal used to receive or process the transaction.';

-- ----------------------------------------------------------------------------
-- service_order_installments: keep old and new column names working together
-- ----------------------------------------------------------------------------
ALTER TABLE public.service_order_installments
    ADD COLUMN IF NOT EXISTS amount numeric(15, 2),
    ADD COLUMN IF NOT EXISTS bank_account_id uuid,
    ADD COLUMN IF NOT EXISTS payment_terminal_id uuid;

UPDATE public.service_order_installments
SET amount = installment_amount
WHERE amount IS NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'service_order_installments_bank_account_fk'
    ) THEN
        ALTER TABLE public.service_order_installments
            ADD CONSTRAINT service_order_installments_bank_account_fk
            FOREIGN KEY (bank_account_id)
            REFERENCES public.bank_accounts (id)
            ON DELETE SET NULL;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'service_order_installments_payment_terminal_fk'
    ) THEN
        ALTER TABLE public.service_order_installments
            ADD CONSTRAINT service_order_installments_payment_terminal_fk
            FOREIGN KEY (payment_terminal_id)
            REFERENCES public.payment_terminals (id)
            ON DELETE SET NULL;
    END IF;
END $$;

ALTER TABLE public.service_order_installments
    ALTER COLUMN amount SET NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_service_order_installment_amount_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.amount IS NULL AND NEW.installment_amount IS NOT NULL THEN
        NEW.amount := NEW.installment_amount;
    END IF;

    IF NEW.installment_amount IS NULL AND NEW.amount IS NOT NULL THEN
        NEW.installment_amount := NEW.amount;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF NEW.amount IS DISTINCT FROM OLD.amount
           AND NEW.installment_amount IS NOT DISTINCT FROM OLD.installment_amount THEN
            NEW.installment_amount := NEW.amount;
        END IF;

        IF NEW.installment_amount IS DISTINCT FROM OLD.installment_amount
           AND NEW.amount IS NOT DISTINCT FROM OLD.amount THEN
            NEW.amount := NEW.installment_amount;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_service_order_installments_sync_amount_columns ON public.service_order_installments;

CREATE TRIGGER trg_service_order_installments_sync_amount_columns
    BEFORE INSERT OR UPDATE ON public.service_order_installments
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_service_order_installment_amount_columns();

COMMENT ON COLUMN public.service_order_installments.amount IS
    'Compatibility alias for installment_amount used by the current application layer.';

COMMENT ON COLUMN public.service_order_installments.bank_account_id IS
    'Optional bank account that received this installment.';

COMMENT ON COLUMN public.service_order_installments.payment_terminal_id IS
    'Optional terminal used to process this installment.';

-- ----------------------------------------------------------------------------
-- bank_account_statements: keep new_balance and balance_after in sync
-- ----------------------------------------------------------------------------
ALTER TABLE public.bank_account_statements
    ADD COLUMN IF NOT EXISTS balance_after numeric(15, 2);

UPDATE public.bank_account_statements
SET balance_after = new_balance
WHERE balance_after IS NULL;

ALTER TABLE public.bank_account_statements
    ALTER COLUMN balance_after SET NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_bank_account_statement_balance_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.balance_after IS NULL AND NEW.new_balance IS NOT NULL THEN
        NEW.balance_after := NEW.new_balance;
    END IF;

    IF NEW.new_balance IS NULL AND NEW.balance_after IS NOT NULL THEN
        NEW.new_balance := NEW.balance_after;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF NEW.balance_after IS DISTINCT FROM OLD.balance_after
           AND NEW.new_balance IS NOT DISTINCT FROM OLD.new_balance THEN
            NEW.new_balance := NEW.balance_after;
        END IF;

        IF NEW.new_balance IS DISTINCT FROM OLD.new_balance
           AND NEW.balance_after IS NOT DISTINCT FROM OLD.balance_after THEN
            NEW.balance_after := NEW.new_balance;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_bank_account_statements_sync_balance_columns ON public.bank_account_statements;

CREATE TRIGGER trg_bank_account_statements_sync_balance_columns
    BEFORE INSERT OR UPDATE ON public.bank_account_statements
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_bank_account_statement_balance_columns();

COMMENT ON COLUMN public.bank_account_statements.balance_after IS
    'Compatibility alias for new_balance used by the current application layer.';