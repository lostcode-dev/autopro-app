-- =============================================================================
-- Migration: 20240101000039_create_notification_preferences.sql
-- Description: Creates the notification_preferences table, which stores
--              per-user notification channel and category opt-in settings.
--
--              One row per Supabase auth user.  user_id is stored as
--              varchar(100) — not a typed FK — because auth.users lives in
--              the auth schema and cross-schema FK enforcement is not
--              recommended in Supabase (same pattern as user_profiles and
--              user_preferences).
--
--              Security model:
--                - Users may only read and update their OWN row.
--                - INSERT/DELETE are performed by the service_role (server
--                  side) at account-creation time.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- TABLE: notification_preferences
-- ---------------------------------------------------------------------------
CREATE TABLE public.notification_preferences (
  -- Primary key
  id                        uuid          NOT NULL DEFAULT gen_random_uuid(),

  -- Reference to the Supabase auth user.
  -- varchar(100) intentionally — no typed FK against auth schema.
  user_id                   varchar(100)  NOT NULL,

  -- ---------------------------------------------------------------------------
  -- Delivery channel opt-ins
  -- ---------------------------------------------------------------------------
  channel_in_app            boolean       NOT NULL DEFAULT true,
  channel_email             boolean       NOT NULL DEFAULT true,
  channel_web_push          boolean       NOT NULL DEFAULT false,
  channel_mobile_push       boolean       NOT NULL DEFAULT false,

  -- ---------------------------------------------------------------------------
  -- Notification category opt-ins
  -- ---------------------------------------------------------------------------
  weekly_digest             boolean       NOT NULL DEFAULT false,
  product_updates           boolean       NOT NULL DEFAULT true,
  important_updates         boolean       NOT NULL DEFAULT true,

  -- ---------------------------------------------------------------------------
  -- Push permission state (mirrors the browser / OS permission prompt result)
  -- ---------------------------------------------------------------------------
  web_push_permission       varchar(20)   NOT NULL DEFAULT 'default',    -- 'default' | 'granted' | 'denied'
  mobile_push_permission    varchar(20)   NOT NULL DEFAULT 'default',    -- 'default' | 'granted' | 'denied'

  -- Audit columns
  created_at                timestamptz   NOT NULL DEFAULT now(),
  updated_at                timestamptz   NOT NULL DEFAULT now(),

  -- -----------------------------------------------------------------
  -- Constraints
  -- -----------------------------------------------------------------
  CONSTRAINT notification_preferences_pkey
    PRIMARY KEY (id),

  -- One preferences row per auth user
  CONSTRAINT notification_preferences_user_id_unique
    UNIQUE (user_id),

  CONSTRAINT notification_preferences_web_push_permission_check
    CHECK (web_push_permission IN ('default', 'granted', 'denied')),

  CONSTRAINT notification_preferences_mobile_push_permission_check
    CHECK (mobile_push_permission IN ('default', 'granted', 'denied'))
);

-- ---------------------------------------------------------------------------
-- COMMENTS
-- ---------------------------------------------------------------------------
COMMENT ON TABLE public.notification_preferences IS
  'Per-user notification delivery channel and category preferences. '
  'One row per Supabase auth user. Controls which channels and categories '
  'the user wants to receive notifications through.';

COMMENT ON COLUMN public.notification_preferences.user_id IS
  'References auth.users.id. Stored as varchar(100) to avoid cross-schema FK '
  'constraints (auth schema); uniqueness is enforced by the unique constraint.';

COMMENT ON COLUMN public.notification_preferences.channel_in_app IS
  'Whether in-app notification bell/feed is enabled for this user.';

COMMENT ON COLUMN public.notification_preferences.channel_email IS
  'Whether email notifications are enabled for this user.';

COMMENT ON COLUMN public.notification_preferences.channel_web_push IS
  'Whether browser web push notifications are enabled.';

COMMENT ON COLUMN public.notification_preferences.channel_mobile_push IS
  'Whether mobile push notifications (via OneSignal) are enabled.';

COMMENT ON COLUMN public.notification_preferences.web_push_permission IS
  'Browser push permission state: ''default'' (not asked), ''granted'', or ''denied''.';

COMMENT ON COLUMN public.notification_preferences.mobile_push_permission IS
  'Mobile push permission state: ''default'' (not asked), ''granted'', or ''denied''.';

-- ---------------------------------------------------------------------------
-- INDEXES
-- ---------------------------------------------------------------------------
CREATE INDEX idx_notification_preferences_user_id
  ON public.notification_preferences (user_id);

-- ---------------------------------------------------------------------------
-- TRIGGER: auto-update updated_at
-- ---------------------------------------------------------------------------
CREATE TRIGGER trg_notification_preferences_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------------------------
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- Users can read only their own preferences row
CREATE POLICY "notification_preferences_select_own"
  ON public.notification_preferences
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid()::text);

-- Users can update only their own preferences row
CREATE POLICY "notification_preferences_update_own"
  ON public.notification_preferences
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);

-- INSERT/DELETE reserved for service_role (no authenticated policy needed;
-- service_role bypasses RLS entirely)
