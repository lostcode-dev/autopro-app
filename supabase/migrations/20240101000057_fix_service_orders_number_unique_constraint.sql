-- =============================================================================
-- Migration: 20240101000057_fix_service_orders_number_unique_constraint.sql
-- Description: Replaces the blanket UNIQUE constraint on (organization_id, number)
--              with a partial unique index that excludes soft-deleted rows.
--              This allows reusing an OS number that was previously soft-deleted.
-- =============================================================================

-- Drop the existing table-level unique constraint
ALTER TABLE public.service_orders
    DROP CONSTRAINT IF EXISTS service_orders_organization_id_number_key;

-- Create a partial unique index that only enforces uniqueness for active records
CREATE UNIQUE INDEX service_orders_organization_id_number_key
    ON public.service_orders (organization_id, number)
    WHERE deleted_at IS NULL;
