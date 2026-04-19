-- =============================================================================
-- Migration: 20240101000050_add_role_to_employees.sql
-- Description: Adds role (job title / occupation) column to employees table.
--              This is a free-text field like "Mecânico", "Gerente", etc.
-- =============================================================================

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS role varchar(100);

COMMENT ON COLUMN public.employees.role IS
  'Free-text job title / occupation of the employee (e.g. Mecânico, Gerente).';
