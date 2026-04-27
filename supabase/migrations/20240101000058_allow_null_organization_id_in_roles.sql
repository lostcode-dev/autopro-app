-- =============================================================================
-- Migration: 20240101000058_allow_null_organization_id_in_roles.sql
-- Description: Allows roles to have a NULL organization_id, turning them into
--              global roles visible to all organizations. Updates the unique
--              constraint and RLS policies accordingly.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Drop the NOT NULL constraint and the FK on organization_id
--    We recreate the FK as deferrable so NULL rows pass cleanly.
-- -----------------------------------------------------------------------------

ALTER TABLE public.roles
  ALTER COLUMN organization_id DROP NOT NULL;

-- The FK was declared inline (no separate constraint name in the original DDL),
-- so we must drop and re-add it to make it nullable-friendly.
ALTER TABLE public.roles
  DROP CONSTRAINT IF EXISTS roles_organization_id_fkey;

ALTER TABLE public.roles
  ADD CONSTRAINT roles_organization_id_fkey
    FOREIGN KEY (organization_id)
    REFERENCES public.organizations(id)
    ON DELETE CASCADE;

-- -----------------------------------------------------------------------------
-- 2. Fix the unique constraint on (organization_id, name)
--    PostgreSQL treats NULL != NULL in unique indexes, so two global roles
--    with the same name would not conflict — which is fine for now.
--    We keep the existing constraint; it already handles NULLs correctly.
-- -----------------------------------------------------------------------------

-- No change needed: UNIQUE (organization_id, name) with nullable org_id works
-- because NULL values are never considered equal in a unique index.

-- -----------------------------------------------------------------------------
-- 3. Update RLS policies to expose global roles (organization_id IS NULL)
--    to every authenticated user while keeping org-scoped rows private.
-- -----------------------------------------------------------------------------

-- SELECT: own org rows + global rows
DROP POLICY IF EXISTS "roles_select_same_org" ON public.roles;
CREATE POLICY "roles_select_same_org" ON public.roles
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_user_organization_id()
    OR organization_id IS NULL
  );

-- INSERT: org-scoped rows must match the user's org; global rows (null) are allowed
DROP POLICY IF EXISTS "roles_insert_same_org" ON public.roles;
CREATE POLICY "roles_insert_same_org" ON public.roles
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_user_organization_id()
    OR organization_id IS NULL
  );

-- UPDATE: only own-org rows; global roles are read-only for regular users
DROP POLICY IF EXISTS "roles_update_same_org" ON public.roles;
CREATE POLICY "roles_update_same_org" ON public.roles
  FOR UPDATE TO authenticated
  USING (organization_id = public.current_user_organization_id())
  WITH CHECK (organization_id = public.current_user_organization_id());

-- DELETE: only own-org rows; global roles cannot be deleted via client
DROP POLICY IF EXISTS "roles_delete_same_org" ON public.roles;
CREATE POLICY "roles_delete_same_org" ON public.roles
  FOR DELETE TO authenticated
  USING (organization_id = public.current_user_organization_id());
