-- ============================================================================
-- Tasks Module Migration
-- ============================================================================

-- 1. Custom types
CREATE TYPE task_status AS ENUM ('pending', 'in_progress', 'completed', 'archived');
CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'critical');

-- 2. Task Lists
CREATE TABLE task_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_task_lists_user_id ON task_lists(user_id);

-- 3. Tasks
CREATE TABLE tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  list_id uuid REFERENCES task_lists(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  priority task_priority NOT NULL DEFAULT 'medium',
  status task_status NOT NULL DEFAULT 'pending',
  due_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_tasks_status ON tasks(user_id, status);
CREATE INDEX idx_tasks_priority ON tasks(user_id, priority);
CREATE INDEX idx_tasks_list_id ON tasks(list_id);
CREATE INDEX idx_tasks_due_date ON tasks(user_id, due_date);

-- 4. Task Subtasks
CREATE TABLE task_subtasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title text NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_task_subtasks_task_id ON task_subtasks(task_id);

-- 5. Task Tags
CREATE TABLE task_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  UNIQUE (user_id, name)
);

CREATE INDEX idx_task_tags_user_id ON task_tags(user_id);

-- 6. Task-Tag Links
CREATE TABLE task_tag_links (
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES task_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, tag_id)
);

CREATE INDEX idx_task_tag_links_tag_id ON task_tag_links(tag_id);

-- ============================================================================
-- RLS Policies
-- ============================================================================

ALTER TABLE task_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_tag_links ENABLE ROW LEVEL SECURITY;

-- Task Lists
CREATE POLICY task_lists_select ON task_lists FOR SELECT USING (user_id = auth.uid());
CREATE POLICY task_lists_insert ON task_lists FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY task_lists_update ON task_lists FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY task_lists_delete ON task_lists FOR DELETE USING (user_id = auth.uid());

-- Tasks
CREATE POLICY tasks_select ON tasks FOR SELECT USING (user_id = auth.uid());
CREATE POLICY tasks_insert ON tasks FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY tasks_update ON tasks FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY tasks_delete ON tasks FOR DELETE USING (user_id = auth.uid());

-- Task Subtasks (via task ownership)
CREATE POLICY task_subtasks_select ON task_subtasks FOR SELECT
  USING (EXISTS (SELECT 1 FROM tasks WHERE tasks.id = task_subtasks.task_id AND tasks.user_id = auth.uid()));
CREATE POLICY task_subtasks_insert ON task_subtasks FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM tasks WHERE tasks.id = task_subtasks.task_id AND tasks.user_id = auth.uid()));
CREATE POLICY task_subtasks_update ON task_subtasks FOR UPDATE
  USING (EXISTS (SELECT 1 FROM tasks WHERE tasks.id = task_subtasks.task_id AND tasks.user_id = auth.uid()));
CREATE POLICY task_subtasks_delete ON task_subtasks FOR DELETE
  USING (EXISTS (SELECT 1 FROM tasks WHERE tasks.id = task_subtasks.task_id AND tasks.user_id = auth.uid()));

-- Task Tags
CREATE POLICY task_tags_select ON task_tags FOR SELECT USING (user_id = auth.uid());
CREATE POLICY task_tags_insert ON task_tags FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY task_tags_update ON task_tags FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY task_tags_delete ON task_tags FOR DELETE USING (user_id = auth.uid());

-- Task Tag Links (via task ownership)
CREATE POLICY task_tag_links_select ON task_tag_links FOR SELECT
  USING (EXISTS (SELECT 1 FROM tasks WHERE tasks.id = task_tag_links.task_id AND tasks.user_id = auth.uid()));
CREATE POLICY task_tag_links_insert ON task_tag_links FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM tasks WHERE tasks.id = task_tag_links.task_id AND tasks.user_id = auth.uid()));
CREATE POLICY task_tag_links_delete ON task_tag_links FOR DELETE
  USING (EXISTS (SELECT 1 FROM tasks WHERE tasks.id = task_tag_links.task_id AND tasks.user_id = auth.uid()));
