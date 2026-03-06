-- ═══════════════════════════════════════════════════════════════════════════════
-- Knowledge Graph Module
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─── knowledge_tags ───────────────────────────────────────────────────────────
CREATE TABLE knowledge_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_knowledge_tags_user ON knowledge_tags(user_id);

ALTER TABLE knowledge_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own knowledge tags"
  ON knowledge_tags FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── knowledge_notes ──────────────────────────────────────────────────────────
CREATE TABLE knowledge_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text,
  type text NOT NULL DEFAULT 'note'
    CHECK (type IN ('note','idea','concept','research','book_note')),
  pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_knowledge_notes_user ON knowledge_notes(user_id);
CREATE INDEX idx_knowledge_notes_type ON knowledge_notes(user_id, type);
CREATE INDEX idx_knowledge_notes_pinned ON knowledge_notes(user_id, pinned);
CREATE INDEX idx_knowledge_notes_title_trgm ON knowledge_notes USING gin (title gin_trgm_ops);

ALTER TABLE knowledge_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own knowledge notes"
  ON knowledge_notes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── note_links ───────────────────────────────────────────────────────────────
CREATE TABLE note_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_note_id uuid NOT NULL REFERENCES knowledge_notes(id) ON DELETE CASCADE,
  target_note_id uuid NOT NULL REFERENCES knowledge_notes(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT no_self_link CHECK (source_note_id <> target_note_id),
  CONSTRAINT unique_link UNIQUE (source_note_id, target_note_id)
);

CREATE INDEX idx_note_links_source ON note_links(source_note_id);
CREATE INDEX idx_note_links_target ON note_links(target_note_id);

ALTER TABLE note_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own note links"
  ON note_links FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM knowledge_notes
      WHERE knowledge_notes.id = note_links.source_note_id
        AND knowledge_notes.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM knowledge_notes
      WHERE knowledge_notes.id = note_links.source_note_id
        AND knowledge_notes.user_id = auth.uid()
    )
  );

-- ─── note_tag_links ──────────────────────────────────────────────────────────
CREATE TABLE note_tag_links (
  note_id uuid NOT NULL REFERENCES knowledge_notes(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES knowledge_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (note_id, tag_id)
);

CREATE INDEX idx_note_tag_links_tag ON note_tag_links(tag_id);

ALTER TABLE note_tag_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own note-tag links"
  ON note_tag_links FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM knowledge_notes
      WHERE knowledge_notes.id = note_tag_links.note_id
        AND knowledge_notes.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM knowledge_notes
      WHERE knowledge_notes.id = note_tag_links.note_id
        AND knowledge_notes.user_id = auth.uid()
    )
  );
