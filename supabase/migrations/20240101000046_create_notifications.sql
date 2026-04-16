-- =============================================================================
-- Migration: 20240101000046_create_notifications.sql
-- Description: Creates the notifications table for AutoPro multi-tenant SaaS.
--              Stores in-app notifications scoped to individual auth users.
--              id is a serial integer so it matches the number type used in
--              the frontend composable (useNotifications) and API endpoints.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- TABLE: notifications
-- -----------------------------------------------------------------------------
CREATE TABLE public.notifications (
    -- Primary key — serial so JS receives a plain number
    id                  serial          PRIMARY KEY,

    -- Owner: Supabase auth user (varchar(100) — same pattern as user_profiles)
    user_id             varchar(100)    NOT NULL,

    -- Optional: restrict visibility to a specific org
    organization_id     uuid,

    -- 'system' = sent by AutoPro itself
    -- 'user'   = sent by another user within the org
    type                varchar(10)     NOT NULL DEFAULT 'system'
                            CHECK (type IN ('system', 'user')),

    -- Notification content
    body                text            NOT NULL,

    -- Optional deep-link inside the app
    link_path           varchar(500),

    -- Delivery channels (e.g. ["in_app","email"]) — stored as jsonb
    channels            jsonb,

    -- Category key for preference filtering (e.g. 'product_updates')
    category            varchar(50),

    -- Source identifier (e.g. 'service_order', 'billing')
    source              varchar(50),

    -- Sender info (denormalized for fast reads — avoids joins on every load)
    sender_name         varchar(200)    NOT NULL DEFAULT 'AutoPro',
    sender_email        varchar(200),
    sender_avatar_src   varchar(500),

    -- Read tracking
    read_at             timestamptz,

    -- Audit
    created_at          timestamptz     NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- INDEXES
-- -----------------------------------------------------------------------------
CREATE INDEX idx_notifications_user_id
    ON public.notifications (user_id, created_at DESC);

CREATE INDEX idx_notifications_user_id_unread
    ON public.notifications (user_id, read_at)
    WHERE read_at IS NULL;

-- -----------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- Users may only read/update their own notification rows.
-- Inserts and deletes are performed by the service_role (server side).
-- -----------------------------------------------------------------------------
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications: owner read"
    ON public.notifications
    FOR SELECT
    USING (user_id = auth.uid()::text);

CREATE POLICY "notifications: owner update"
    ON public.notifications
    FOR UPDATE
    USING (user_id = auth.uid()::text)
    WITH CHECK (user_id = auth.uid()::text);

-- -----------------------------------------------------------------------------
-- COMMENTS
-- -----------------------------------------------------------------------------
COMMENT ON TABLE public.notifications IS
    'In-app notifications per auth user. Supports system and user-generated '
    'notifications with optional org scoping, deep-link, and read tracking.';

COMMENT ON COLUMN public.notifications.user_id IS
    'References auth.users.id. Stored as varchar(100) to avoid cross-schema FK.';

COMMENT ON COLUMN public.notifications.type IS
    '''system'' = sent by AutoPro; ''user'' = sent by another user in the org.';

COMMENT ON COLUMN public.notifications.channels IS
    'JSON array of delivery channels used, e.g. ["in_app","email"].';

COMMENT ON COLUMN public.notifications.read_at IS
    'NULL means unread. Set to the timestamp when the user opened/dismissed.';
