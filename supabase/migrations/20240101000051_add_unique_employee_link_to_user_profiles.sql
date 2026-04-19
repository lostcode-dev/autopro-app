-- =============================================================================
-- Migration: 20240101000051_add_unique_employee_link_to_user_profiles.sql
-- Description: Ensures that each employee can be linked to at most one active
--              user profile at a time. This prevents duplicate access grants
--              and keeps employee <-> user synchronization deterministic.
-- =============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_employee_id_unique
  ON public.user_profiles (employee_id)
  WHERE employee_id IS NOT NULL
    AND deleted_at IS NULL;
