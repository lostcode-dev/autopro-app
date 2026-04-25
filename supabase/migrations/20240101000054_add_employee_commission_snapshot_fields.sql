-- =============================================================================
-- Migration: 20240101000054_add_employee_commission_snapshot_fields
-- Description: Adds optional commission snapshot columns to
--              employee_financial_records for richer commission reports while
--              preserving backward compatibility with the core schema.
-- =============================================================================

ALTER TABLE public.employee_financial_records
    ADD COLUMN IF NOT EXISTS commission_type varchar(20),
    ADD COLUMN IF NOT EXISTS commission_percentage numeric(10, 4),
    ADD COLUMN IF NOT EXISTS commission_base varchar(20),
    ADD COLUMN IF NOT EXISTS item_name varchar(300),
    ADD COLUMN IF NOT EXISTS item_amount numeric(15, 2),
    ADD COLUMN IF NOT EXISTS item_cost numeric(15, 2);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'employee_financial_records_commission_type_check'
    ) THEN
        ALTER TABLE public.employee_financial_records
            ADD CONSTRAINT employee_financial_records_commission_type_check
            CHECK (
                commission_type IS NULL OR commission_type IN ('percentage', 'fixed_amount')
            );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'employee_financial_records_commission_base_check'
    ) THEN
        ALTER TABLE public.employee_financial_records
            ADD CONSTRAINT employee_financial_records_commission_base_check
            CHECK (
                commission_base IS NULL OR commission_base IN ('revenue', 'profit')
            );
    END IF;
END $$;

COMMENT ON COLUMN public.employee_financial_records.commission_type IS
    'Optional commission rule snapshot captured when the record is generated.';

COMMENT ON COLUMN public.employee_financial_records.commission_percentage IS
    'Optional commission percentage snapshot for percentage-based commissions.';

COMMENT ON COLUMN public.employee_financial_records.commission_base IS
    'Optional commission base snapshot: revenue or profit.';

COMMENT ON COLUMN public.employee_financial_records.item_name IS
    'Optional item name snapshot used to preserve historical commission breakdown.';

COMMENT ON COLUMN public.employee_financial_records.item_amount IS
    'Optional item sale amount snapshot used in historical commission reports.';

COMMENT ON COLUMN public.employee_financial_records.item_cost IS
    'Optional item cost snapshot used in historical commission reports.';