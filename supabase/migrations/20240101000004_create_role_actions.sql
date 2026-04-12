-- =============================================================================
-- FILE: 20240101000004_create_role_actions.sql
-- PROJECT: AutoPro — Automotive Workshop Management (Multi-Tenant SaaS)
-- PURPOSE: Creates the role_actions junction table, which maps individual
--          actions (permissions) to roles within a tenant.  A single row
--          means "role X has action Y", with is_granted allowing explicit
--          deny semantics if needed in the future.
--
-- NOTES:
--   - role_actions has no organization_id column of its own; tenant scoping
--     is derived through the roles table (roles.organization_id).
--   - RLS policies use an EXISTS subquery into public.roles to verify that
--     the role being accessed belongs to the authenticated user's org.
--   - (role_id, action_id) UNIQUE prevents duplicate grants for the same
--     role/action pair.
--   - Both FKs use ON DELETE CASCADE: removing a role or action automatically
--     cleans up the related permission assignments.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- TABLE: public.role_actions
-- ---------------------------------------------------------------------------

CREATE TABLE public.role_actions (
  -- Primary key
  id          uuid     NOT NULL DEFAULT uuid_generate_v4(),

  -- FK to the role that owns this permission grant
  role_id     uuid     NOT NULL
                REFERENCES public.roles(id)   ON DELETE CASCADE,

  -- FK to the global action being granted (or denied)
  action_id   uuid     NOT NULL
                REFERENCES public.actions(id) ON DELETE CASCADE,

  -- true  = permission is explicitly granted
  -- false = permission is explicitly denied (future deny-override semantics)
  is_granted  boolean  NOT NULL DEFAULT false,

  -- Audit columns (standard across all tables)
  created_at  timestamptz  NOT NULL DEFAULT now(),
  created_by  varchar(200),
  updated_at  timestamptz  NOT NULL DEFAULT now(),
  updated_by  varchar(200),
  deleted_at  timestamptz,
  deleted_by  varchar(200),

  CONSTRAINT role_actions_pkey                PRIMARY KEY (id),
  CONSTRAINT role_actions_role_action_unique  UNIQUE (role_id, action_id)
);

COMMENT ON TABLE  public.role_actions IS 'Junction table mapping actions (permissions) to roles. Tenant-scoped via roles.organization_id.';
COMMENT ON COLUMN public.role_actions.is_granted IS 'true = granted, false = explicitly denied. Defaults false — set true when assigning a permission.';


-- ---------------------------------------------------------------------------
-- AUTO-UPDATE TRIGGER
-- ---------------------------------------------------------------------------

CREATE TRIGGER trg_role_actions_updated_at
  BEFORE UPDATE ON public.role_actions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ---------------------------------------------------------------------------
-- INDEXES
-- ---------------------------------------------------------------------------

-- Lookup all action grants for a specific role (most common access pattern)
CREATE INDEX idx_role_actions_role_id
  ON public.role_actions (role_id);

-- Lookup all roles that have been granted a specific action
CREATE INDEX idx_role_actions_action_id
  ON public.role_actions (action_id);


-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------

ALTER TABLE public.role_actions ENABLE ROW LEVEL SECURITY;

-- SELECT: only rows whose parent role belongs to the user's organization
CREATE POLICY "role_actions_select_same_org" ON public.role_actions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.roles r
      WHERE r.id         = role_id
        AND r.organization_id = public.current_user_organization_id()
        AND r.deleted_at IS NULL
    )
  );

-- INSERT: only allow assigning actions to roles in the user's organization
CREATE POLICY "role_actions_insert_same_org" ON public.role_actions
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.roles r
      WHERE r.id         = role_id
        AND r.organization_id = public.current_user_organization_id()
        AND r.deleted_at IS NULL
    )
  );

-- UPDATE: restrict to role_actions rows whose role belongs to the user's org
CREATE POLICY "role_actions_update_same_org" ON public.role_actions
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.roles r
      WHERE r.id         = role_id
        AND r.organization_id = public.current_user_organization_id()
        AND r.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.roles r
      WHERE r.id         = role_id
        AND r.organization_id = public.current_user_organization_id()
        AND r.deleted_at IS NULL
    )
  );

-- DELETE: restrict to role_actions rows whose role belongs to the user's org
CREATE POLICY "role_actions_delete_same_org" ON public.role_actions
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.roles r
      WHERE r.id         = role_id
        AND r.organization_id = public.current_user_organization_id()
        AND r.deleted_at IS NULL
    )
  );
