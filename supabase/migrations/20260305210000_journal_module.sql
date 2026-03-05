-- ============================================================================
-- Journal Module Migration
-- Tables: journal_entries, journal_tags, journal_entry_tags,
--         metric_definitions, metric_values
-- ============================================================================

-- ─── Enum ────────────────────────────────────────────────────────────────────

CREATE TYPE metric_type AS ENUM ('number', 'scale', 'boolean', 'select', 'text');

-- ─── journal_entries ─────────────────────────────────────────────────────────

CREATE TABLE journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  entry_date date NOT NULL,
  title text,
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  UNIQUE (user_id, entry_date)
);

CREATE INDEX idx_journal_entries_user ON journal_entries(user_id);
CREATE INDEX idx_journal_entries_date ON journal_entries(entry_date);

ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "journal_entries_select" ON journal_entries
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "journal_entries_insert" ON journal_entries
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "journal_entries_update" ON journal_entries
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "journal_entries_delete" ON journal_entries
  FOR DELETE USING (user_id = auth.uid());

-- ─── journal_tags ────────────────────────────────────────────────────────────

CREATE TABLE journal_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

CREATE INDEX idx_journal_tags_user ON journal_tags(user_id);

ALTER TABLE journal_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "journal_tags_select" ON journal_tags
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "journal_tags_insert" ON journal_tags
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "journal_tags_update" ON journal_tags
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "journal_tags_delete" ON journal_tags
  FOR DELETE USING (user_id = auth.uid());

-- ─── journal_entry_tags ──────────────────────────────────────────────────────

CREATE TABLE journal_entry_tags (
  entry_id uuid NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES journal_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (entry_id, tag_id)
);

ALTER TABLE journal_entry_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "journal_entry_tags_select" ON journal_entry_tags
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM journal_entries WHERE id = entry_id AND user_id = auth.uid())
  );

CREATE POLICY "journal_entry_tags_insert" ON journal_entry_tags
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM journal_entries WHERE id = entry_id AND user_id = auth.uid())
  );

CREATE POLICY "journal_entry_tags_delete" ON journal_entry_tags
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM journal_entries WHERE id = entry_id AND user_id = auth.uid())
  );

-- ─── metric_definitions ─────────────────────────────────────────────────────

CREATE TABLE metric_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  key text NOT NULL,
  name text NOT NULL,
  description text,
  type metric_type NOT NULL,
  unit text,
  min_value numeric,
  max_value numeric,
  step numeric,
  options text[],
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, key)
);

CREATE INDEX idx_metric_definitions_user ON metric_definitions(user_id);

ALTER TABLE metric_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "metric_definitions_select" ON metric_definitions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "metric_definitions_insert" ON metric_definitions
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "metric_definitions_update" ON metric_definitions
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "metric_definitions_delete" ON metric_definitions
  FOR DELETE USING (user_id = auth.uid());

-- ─── metric_values ───────────────────────────────────────────────────────────

CREATE TABLE metric_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  entry_date date NOT NULL,
  metric_definition_id uuid NOT NULL REFERENCES metric_definitions(id) ON DELETE CASCADE,
  number_value numeric,
  boolean_value boolean,
  text_value text,
  select_value text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, entry_date, metric_definition_id)
);

CREATE INDEX idx_metric_values_user_date ON metric_values(user_id, entry_date);
CREATE INDEX idx_metric_values_definition ON metric_values(metric_definition_id);

ALTER TABLE metric_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "metric_values_select" ON metric_values
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "metric_values_insert" ON metric_values
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "metric_values_update" ON metric_values
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "metric_values_delete" ON metric_values
  FOR DELETE USING (user_id = auth.uid());
