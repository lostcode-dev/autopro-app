-- =============================================================================
-- FILE: 20240101000003_create_actions.sql
-- PROJECT: AutoPro — Automotive Workshop Management (Multi-Tenant SaaS)
-- PURPOSE: Creates the actions table, which holds the global catalogue of
--          permissions/capabilities available in the system.  Actions are
--          system-wide (not tenant-scoped) and are seeded by the service
--          role.  Tenants assign actions to their roles via role_actions.
--
-- NOTES:
--   - Actions are NOT tenant-scoped (no organization_id column).  They form
--     a global permission registry valid for all organizations.
--   - code is UNIQUE across the entire table (e.g. "customers:create").
--   - resource groups related actions (e.g. "customers", "service_orders").
--   - action_type describes the kind of operation the action permits.
--   - Authenticated users can SELECT actions (to build UI permission checks)
--     but cannot INSERT, UPDATE, or DELETE them — that is service-role only.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- TABLE: public.actions
-- ---------------------------------------------------------------------------

CREATE TABLE public.actions (
  -- Primary key
  id           uuid          NOT NULL DEFAULT uuid_generate_v4(),

  -- Unique machine-readable permission code, e.g. "service_orders:create"
  code         varchar(100)  NOT NULL,

  -- Human-readable name, e.g. "Create Service Orders"
  name         varchar(100)  NOT NULL,

  -- Logical resource group this action belongs to, e.g. "service_orders"
  resource     varchar(100)  NOT NULL,

  -- Category of operation this action permits
  action_type  varchar(20)   NOT NULL
                 CHECK (action_type IN ('create', 'read', 'update', 'delete', 'manage', 'view')),

  -- Optional longer description for admin UI tooltips
  description  text,

  -- Audit columns (standard across all tables)
  created_at  timestamptz  NOT NULL DEFAULT now(),
  created_by  varchar(200),
  updated_at  timestamptz  NOT NULL DEFAULT now(),
  updated_by  varchar(200),
  deleted_at  timestamptz,
  deleted_by  varchar(200),

  CONSTRAINT actions_pkey        PRIMARY KEY (id),
  CONSTRAINT actions_code_unique UNIQUE (code)
);

COMMENT ON TABLE  public.actions IS 'Global permission catalogue. System-seeded — not tenant-scoped.';
COMMENT ON COLUMN public.actions.code        IS 'Unique slug used in code-level permission checks, e.g. "customers:create".';
COMMENT ON COLUMN public.actions.resource    IS 'Logical grouping for the permission, e.g. "customers", "service_orders".';
COMMENT ON COLUMN public.actions.action_type IS 'Type of operation: create | read | update | delete | manage | view.';


-- ---------------------------------------------------------------------------
-- AUTO-UPDATE TRIGGER
-- ---------------------------------------------------------------------------

CREATE TRIGGER trg_actions_updated_at
  BEFORE UPDATE ON public.actions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ---------------------------------------------------------------------------
-- INDEXES
-- ---------------------------------------------------------------------------

-- Lookup all active actions for a given resource (e.g. build role editor UI)
CREATE INDEX idx_actions_resource
  ON public.actions (resource)
  WHERE deleted_at IS NULL;

-- Direct lookup by code (used in runtime permission checks — keep hot)
CREATE INDEX idx_actions_code
  ON public.actions (code);


-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------

ALTER TABLE public.actions ENABLE ROW LEVEL SECURITY;

-- Authenticated users may read any non-deleted action (needed for UI / checks)
CREATE POLICY "actions_select_authenticated" ON public.actions
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

-- INSERT, UPDATE, DELETE are intentionally restricted to service role only.
-- No authenticated policies for those operations.
