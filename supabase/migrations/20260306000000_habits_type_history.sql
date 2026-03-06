-- ============================================================================
-- Habits Module — Add habit_type, sort_order, and change history
-- ============================================================================

-- 1. Add habit_type enum
CREATE TYPE habit_type AS ENUM ('positive', 'negative');

-- 2. Add habit_type and sort_order columns to habits
ALTER TABLE habits
  ADD COLUMN habit_type habit_type NOT NULL DEFAULT 'positive',
  ADD COLUMN sort_order int NOT NULL DEFAULT 0;

-- 3. Habit Change History (tracks changes to difficulty, frequency, identity)
CREATE TABLE habit_change_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id uuid NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  field text NOT NULL,       -- e.g. 'difficulty', 'frequency', 'identity_id'
  old_value text,
  new_value text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_habit_change_history_habit_id ON habit_change_history(habit_id);
CREATE INDEX idx_habit_change_history_user_id ON habit_change_history(user_id);
CREATE INDEX idx_habit_change_history_created_at ON habit_change_history(created_at);

-- 4. RLS for habit_change_history
ALTER TABLE habit_change_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY habit_change_history_select ON habit_change_history FOR SELECT USING (user_id = auth.uid());
CREATE POLICY habit_change_history_insert ON habit_change_history FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY habit_change_history_delete ON habit_change_history FOR DELETE USING (user_id = auth.uid());
