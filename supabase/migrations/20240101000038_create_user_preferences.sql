-- =============================================================================
-- Migration: 20240101000038_create_user_preferences.sql
-- Description: Creates the user_preferences table, which stores per-user
--              UI/theme preferences (primary colour, neutral colour, colour
--              mode, and timezone).
--
--              One row per Supabase auth user.  user_id is stored as
--              varchar(100) — not a typed FK — because auth.users lives in
--              the auth schema and cross-schema FK enforcement is not
--              recommended in Supabase (same pattern as user_profiles).
--
--              Security model:
--                - Users may only read and update their OWN preferences row.
--                - INSERT/DELETE are performed by the service_role (server
--                  side) at account-creation time.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- TABLE: user_preferences
-- ---------------------------------------------------------------------------
CREATE TABLE public.user_preferences (
  -- Primary key
  id                uuid          NOT NULL DEFAULT gen_random_uuid(),

  -- Reference to the Supabase auth user.
  -- varchar(100) intentionally — no typed FK against auth schema.
  user_id           varchar(100)  NOT NULL,

  -- Theme configuration
  primary_color     varchar(50)   NOT NULL DEFAULT 'emerald',  -- Tailwind/NuxtUI colour name
  neutral_color     varchar(50)   NOT NULL DEFAULT 'slate',    -- Tailwind/NuxtUI neutral name
  color_mode        varchar(20)   NOT NULL DEFAULT 'light',    -- 'light' | 'dark'

  -- Locale / time
  timezone          varchar(100)  NOT NULL DEFAULT 'UTC',      -- IANA timezone identifier

  -- Audit columns
  created_at        timestamptz   NOT NULL DEFAULT now(),
  updated_at        timestamptz   NOT NULL DEFAULT now(),

  -- -----------------------------------------------------------------
  -- Constraints
  -- -----------------------------------------------------------------
  CONSTRAINT user_preferences_pkey
    PRIMARY KEY (id),

  -- One preferences row per auth user
  CONSTRAINT user_preferences_user_id_unique
    UNIQUE (user_id),

  CONSTRAINT user_preferences_color_mode_check
    CHECK (color_mode IN ('light', 'dark'))
);

-- ---------------------------------------------------------------------------
-- COMMENTS
-- ---------------------------------------------------------------------------
COMMENT ON TABLE public.user_preferences IS
  'Per-user UI/theme preferences (colour palette, colour mode, timezone). '
  'One row per Supabase auth user. Scoped to the individual user, not to an '
  'organisation.';

COMMENT ON COLUMN public.user_preferences.user_id IS
  'References auth.users.id. Stored as varchar(100) to avoid cross-schema FK '
  'constraints (auth schema); uniqueness is enforced by the unique constraint.';

COMMENT ON COLUMN public.user_preferences.primary_color IS
  'Tailwind / NuxtUI primary colour token (e.g. ''emerald'', ''purple'').';

COMMENT ON COLUMN public.user_preferences.neutral_color IS
  'Tailwind / NuxtUI neutral colour token (e.g. ''slate'', ''zinc'').';

COMMENT ON COLUMN public.user_preferences.color_mode IS
  'UI colour mode: ''light'' or ''dark''.';

COMMENT ON COLUMN public.user_preferences.timezone IS
  'IANA timezone identifier used for date/time display (e.g. ''America/Sao_Paulo'').';

-- ---------------------------------------------------------------------------
-- INDEXES
-- ---------------------------------------------------------------------------
CREATE INDEX idx_user_preferences_user_id
  ON public.user_preferences (user_id);

-- ---------------------------------------------------------------------------
-- TRIGGER: auto-update updated_at
-- ---------------------------------------------------------------------------
CREATE TRIGGER trg_user_preferences_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Users can read only their own preferences row
CREATE POLICY "user_preferences_select_own"
  ON public.user_preferences
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid()::text);

-- Users can update only their own preferences row
CREATE POLICY "user_preferences_update_own"
  ON public.user_preferences
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

-- INSERT/DELETE reserved for service_role (no authenticated policy needed;
-- service_role bypasses RLS entirely)
