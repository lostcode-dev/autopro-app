-- =============================================================================
-- FILE: 20240101000002_create_roles.sql
-- PROJECT: AutoPro — Automotive Workshop Management (Multi-Tenant SaaS)
-- PURPOSE: Creates the roles table, which defines named permission groups
--          within each organization (tenant).  Each role is associated with
--          a set of actions via the role_actions junction table.
--
-- NOTES:
--   - (organization_id, name) is UNIQUE to prevent duplicate role names
--     within the same tenant while allowing the same name across tenants.
--   - is_system_role flags built-in roles (e.g. "admin", "owner") that are
--     seeded by the service layer and should not be deleted by users.
--   - Standard org-scoped RLS: all CRUD operations are restricted to rows
--     belonging to the authenticated user's organization.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- TABLE: public.roles
-- ---------------------------------------------------------------------------

CREATE TABLE public.roles (
  -- Primary key
  id               uuid          NOT NULL DEFAULT uuid_generate_v4(),

  -- Tenant scope
  organization_id  uuid          NOT NULL
                     REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Role identity
  name             varchar(100)  NOT NULL,          -- machine-friendly slug (e.g. "admin")
  display_name     varchar(100)  NOT NULL,          -- human-readable label (e.g. "Administrator")
  description      text,

  -- System flag: true = seeded by service role, protected from user deletion
  is_system_role   boolean       NOT NULL DEFAULT false,

  -- Audit columns (standard across all tables)
  created_at  timestamptz  NOT NULL DEFAULT now(),
  created_by  varchar(200),
  updated_at  timestamptz  NOT NULL DEFAULT now(),
  updated_by  varchar(200),
  deleted_at  timestamptz,
  deleted_by  varchar(200),

  CONSTRAINT roles_pkey PRIMARY KEY (id),

  -- Role names must be unique within a tenant
  CONSTRAINT roles_organization_id_name_key UNIQUE (organization_id, name)
);

COMMENT ON TABLE  public.roles IS 'Permission groups scoped to a tenant organization.';
COMMENT ON COLUMN public.roles.name             IS 'Machine-friendly slug (lowercase, no spaces). Unique per organization.';
COMMENT ON COLUMN public.roles.display_name     IS 'Human-readable role label shown in the UI.';
COMMENT ON COLUMN public.roles.is_system_role   IS 'When true, this role was seeded by the system and must not be deleted by tenants.';


-- ---------------------------------------------------------------------------
-- AUTO-UPDATE TRIGGER
-- ---------------------------------------------------------------------------

CREATE TRIGGER trg_roles_updated_at
  BEFORE UPDATE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ---------------------------------------------------------------------------
-- INDEXES
-- ---------------------------------------------------------------------------

-- Primary lookup: all active roles for a given organization
CREATE INDEX idx_roles_organization_id
  ON public.roles (organization_id)
  WHERE deleted_at IS NULL;


-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "roles_select_same_org" ON public.roles
  FOR SELECT TO authenticated
  USING (organization_id = public.current_user_organization_id());

CREATE POLICY "roles_insert_same_org" ON public.roles
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.current_user_organization_id());

CREATE POLICY "roles_update_same_org" ON public.roles
  FOR UPDATE TO authenticated
  USING (organization_id = public.current_user_organization_id())
  WITH CHECK (organization_id = public.current_user_organization_id());

CREATE POLICY "roles_delete_same_org" ON public.roles
  FOR DELETE TO authenticated
  USING (organization_id = public.current_user_organization_id());
