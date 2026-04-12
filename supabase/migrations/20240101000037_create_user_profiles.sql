-- =============================================================================
-- Migration: 20240101000037_create_user_profiles.sql
-- Description: Creates the user_profiles table, which extends Supabase
--              auth.users with app-specific profile data (display name,
--              avatar, role, and employee link) for each tenant user.
--
--              Security model:
--                - Any authenticated user can READ profiles within their org.
--                - Authenticated users can UPDATE only their OWN profile.
--                - INSERT and DELETE are reserved for the service_role
--                  (user creation/deletion is managed server-side).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- TABLE: user_profiles
-- ---------------------------------------------------------------------------
CREATE TABLE public.user_profiles (
  -- Primary key
  id                    uuid          NOT NULL DEFAULT gen_random_uuid(),

  -- Reference to the Supabase auth user.
  -- Typed as varchar(100) rather than a typed FK because auth.users lives in
  -- the auth schema and cross-schema FK enforcement is not recommended in
  -- Supabase. The UNIQUE constraint still guarantees one profile per auth user.
  user_id               varchar(100)  NOT NULL,

  -- Multi-tenancy scope
  organization_id       uuid          NOT NULL,

  -- Profile display fields
  display_name          varchar(200),         -- User's preferred display name shown in the UI
  profile_picture_url   varchar(500),         -- URL to the user's avatar / profile picture

  -- Authorization — links this profile to a role definition
  role_id               uuid,

  -- Optional link to an employee record (not every user is an employee)
  employee_id           uuid,

  -- Account state
  is_active             boolean       NOT NULL DEFAULT true,

  -- Audit columns
  created_at            timestamptz   NOT NULL DEFAULT now(),
  created_by            varchar(200),
  updated_at            timestamptz   NOT NULL DEFAULT now(),
  updated_by            varchar(200),
  deleted_at            timestamptz,
  deleted_by            varchar(200),

  -- -----------------------------------------------------------------
  -- Constraints
  -- -----------------------------------------------------------------
  CONSTRAINT user_profiles_pkey
    PRIMARY KEY (id),

  -- One profile per Supabase auth user (globally, not per-org)
  CONSTRAINT user_profiles_user_id_unique
    UNIQUE (user_id),

  CONSTRAINT user_profiles_organization_fk
    FOREIGN KEY (organization_id)
    REFERENCES public.organizations(id)
    ON DELETE CASCADE,

  -- role_id references the app roles table; profile becomes role-less if role is deleted
  CONSTRAINT user_profiles_role_fk
    FOREIGN KEY (role_id)
    REFERENCES public.roles(id)
    ON DELETE SET NULL,

  -- employee_id is nullable — not all users correspond to an employee record
  CONSTRAINT user_profiles_employee_fk
    FOREIGN KEY (employee_id)
    REFERENCES public.employees(id)
    ON DELETE SET NULL
);

-- ---------------------------------------------------------------------------
-- COMMENTS
-- ---------------------------------------------------------------------------
COMMENT ON TABLE public.user_profiles IS
  'Extends Supabase auth.users with app-specific profile data per tenant. '
  'One row per (user, organization) pair. INSERT/DELETE managed by service_role only.';

COMMENT ON COLUMN public.user_profiles.user_id IS
  'References auth.users.id (Supabase Auth). Stored as varchar(100) to avoid '
  'cross-schema typed FK constraints. Globally unique — one profile per auth user.';
COMMENT ON COLUMN public.user_profiles.organization_id IS
  'Tenant scope — every profile belongs to exactly one organization.';
COMMENT ON COLUMN public.user_profiles.display_name IS
  'User''s preferred display name shown in the UI. May differ from the auth email name.';
COMMENT ON COLUMN public.user_profiles.profile_picture_url IS
  'Fully-qualified URL to the user''s avatar/profile picture (e.g. Supabase Storage URL).';
COMMENT ON COLUMN public.user_profiles.role_id IS
  'App-level role assigned to this user within the organization. NULL = no role assigned.';
COMMENT ON COLUMN public.user_profiles.employee_id IS
  'Optional link to an employees record. NULL when the user is not also an employee '
  '(e.g. owners, external collaborators).';
COMMENT ON COLUMN public.user_profiles.is_active IS
  'Whether this user profile is active. Inactive profiles cannot log in to the app.';

-- ---------------------------------------------------------------------------
-- INDEXES
-- ---------------------------------------------------------------------------

-- Note: user_id already has an implicit unique index from the UNIQUE constraint.

-- Partial index for active (non-deleted) profiles scoped to an organization
CREATE INDEX idx_user_profiles_organization_id
  ON public.user_profiles (organization_id)
  WHERE deleted_at IS NULL;

-- FK index — supports role-based lookups (e.g. "all users with role X")
CREATE INDEX idx_user_profiles_role_id
  ON public.user_profiles (role_id);

-- FK index — supports employee↔user joins
CREATE INDEX idx_user_profiles_employee_id
  ON public.user_profiles (employee_id);

-- Composite index for the most common list query: active users within an org
CREATE INDEX idx_user_profiles_organization_is_active
  ON public.user_profiles (organization_id, is_active)
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- AUTO-UPDATE TRIGGER: keep updated_at current on every UPDATE
-- ---------------------------------------------------------------------------
CREATE TRIGGER trg_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- Special security model — see table comment for full rationale.
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- SELECT: any authenticated user can read all profiles within their organization
--         (needed for displaying names/avatars of teammates throughout the app)
CREATE POLICY "user_profiles_select_same_org"
  ON public.user_profiles
  FOR SELECT TO authenticated
  USING (organization_id = public.current_user_organization_id());

-- UPDATE: authenticated users can only update their OWN profile row.
--         Role assignment, employee linking, and is_active changes are
--         intentionally controlled server-side via service_role.
CREATE POLICY "user_profiles_update_own"
  ON public.user_profiles
  FOR UPDATE TO authenticated
  USING (user_id = (auth.uid())::text)
  WITH CHECK (user_id = (auth.uid())::text);

-- NOTE: No INSERT or DELETE policies for authenticated users.
--       User provisioning and deprovisioning are managed server-side
--       by the service_role (e.g. via Edge Functions or server API routes).
