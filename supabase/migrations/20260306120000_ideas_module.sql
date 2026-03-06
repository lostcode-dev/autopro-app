-- ═══════════════════════════════════════════════════════════════════════════════
-- Ideas Module
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── idea_lists ───────────────────────────────────────────────────────────────
CREATE TABLE idea_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_idea_lists_user ON idea_lists(user_id);

ALTER TABLE idea_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own idea lists"
  ON idea_lists FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── ideas ────────────────────────────────────────────────────────────────────
CREATE TABLE ideas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  list_id uuid REFERENCES idea_lists(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  priority text CHECK (priority IS NULL OR priority IN ('low','medium','high','critical')),
  status text NOT NULL DEFAULT 'backlog'
    CHECK (status IN ('backlog','todo','in_progress','done','archived')),
  due_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_ideas_user ON ideas(user_id);
CREATE INDEX idx_ideas_user_status ON ideas(user_id, status);
CREATE INDEX idx_ideas_user_list ON ideas(user_id, list_id);
CREATE INDEX idx_ideas_user_priority ON ideas(user_id, priority);
CREATE INDEX idx_ideas_user_due ON ideas(user_id, due_date);

ALTER TABLE ideas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own ideas"
  ON ideas FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── idea_subtasks ────────────────────────────────────────────────────────────
CREATE TABLE idea_subtasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idea_id uuid NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  title text NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_idea_subtasks_idea ON idea_subtasks(idea_id);

ALTER TABLE idea_subtasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own idea subtasks"
  ON idea_subtasks FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM ideas
      WHERE ideas.id = idea_subtasks.idea_id
        AND ideas.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ideas
      WHERE ideas.id = idea_subtasks.idea_id
        AND ideas.user_id = auth.uid()
    )
  );

-- ─── idea_tags ────────────────────────────────────────────────────────────────
CREATE TABLE idea_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_idea_tags_user ON idea_tags(user_id);

ALTER TABLE idea_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own idea tags"
  ON idea_tags FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── idea_tag_links ──────────────────────────────────────────────────────────
CREATE TABLE idea_tag_links (
  idea_id uuid NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES idea_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (idea_id, tag_id)
);

CREATE INDEX idx_idea_tag_links_tag ON idea_tag_links(tag_id);

ALTER TABLE idea_tag_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own idea-tag links"
  ON idea_tag_links FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM ideas
      WHERE ideas.id = idea_tag_links.idea_id
        AND ideas.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ideas
      WHERE ideas.id = idea_tag_links.idea_id
        AND ideas.user_id = auth.uid()
    )
  );
