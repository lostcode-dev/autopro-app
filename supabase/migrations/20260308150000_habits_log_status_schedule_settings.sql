-- ============================================================================
-- Habits Module — Log status, scheduled time, user settings, sharing
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Log status enum (done / done_later / skipped)
-- ----------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'habit_log_status'
  ) THEN
    CREATE TYPE habit_log_status AS ENUM ('done', 'done_later', 'skipped');
  END IF;
END$$;

ALTER TABLE habit_logs
  ADD COLUMN IF NOT EXISTS status habit_log_status NOT NULL DEFAULT 'done';

-- migrate existing boolean completed -> enum status
UPDATE habit_logs
SET status = CASE
  WHEN completed THEN 'done'::habit_log_status
  ELSE 'skipped'::habit_log_status
END
WHERE status IS NULL;

-- ----------------------------------------------------------------------------
-- 2. Scheduled time per habit
-- ----------------------------------------------------------------------------

ALTER TABLE habits
  ADD COLUMN IF NOT EXISTS scheduled_time time;

-- ----------------------------------------------------------------------------
-- 3. Scheduled time in habit_versions (for historical accuracy)
-- ----------------------------------------------------------------------------

ALTER TABLE habit_versions
  ADD COLUMN IF NOT EXISTS scheduled_time time;

UPDATE habit_versions hv
SET scheduled_time = h.scheduled_time
FROM habits h
WHERE hv.habit_id = h.id
AND hv.scheduled_time IS NULL;

-- ----------------------------------------------------------------------------
-- 4. Habit user settings (review day, reminders, sharing)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS habit_user_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  review_day smallint NOT NULL DEFAULT 0 CHECK (review_day BETWEEN 0 AND 6),
  review_reminder_enabled boolean NOT NULL DEFAULT false,
  review_reminder_time time NOT NULL DEFAULT '09:00',
  share_token text UNIQUE,
  share_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- Updated_at trigger
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_habit_user_settings_updated_at
ON habit_user_settings;

CREATE TRIGGER set_habit_user_settings_updated_at
BEFORE UPDATE ON habit_user_settings
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------

ALTER TABLE habit_user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS habit_user_settings_select ON habit_user_settings;
CREATE POLICY habit_user_settings_select
ON habit_user_settings
FOR SELECT
USING (user_id = auth.uid());

DROP POLICY IF EXISTS habit_user_settings_insert ON habit_user_settings;
CREATE POLICY habit_user_settings_insert
ON habit_user_settings
FOR INSERT
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS habit_user_settings_update ON habit_user_settings;
CREATE POLICY habit_user_settings_update
ON habit_user_settings
FOR UPDATE
USING (user_id = auth.uid());

DROP POLICY IF EXISTS habit_user_settings_delete ON habit_user_settings;
CREATE POLICY habit_user_settings_delete
ON habit_user_settings
FOR DELETE
USING (user_id = auth.uid());