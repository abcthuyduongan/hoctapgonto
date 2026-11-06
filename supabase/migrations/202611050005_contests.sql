-- Migration: 202611050005_contests.sql
-- Contest mock sessions and progress tracking for Violympic & IOE (Tuần 7 - Cổng C7)

CREATE TABLE IF NOT EXISTS bao_an.contest_sessions(
  workspace_id text NOT NULL,
  student_id text NOT NULL,
  session_id text PRIMARY KEY,
  request_id text,
  preset_id text NOT NULL,
  title text NOT NULL,
  subject text NOT NULL,
  grade integer NOT NULL,
  duration_seconds integer NOT NULL,
  started_at text NOT NULL,
  deadline_at text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'submitted', 'timeout', 'abandoned')),
  items_json jsonb NOT NULL,
  submitted_at text,
  score integer DEFAULT 0,
  max_score integer DEFAULT 0,
  correct_count integer DEFAULT 0,
  total_items integer DEFAULT 0,
  answers_json jsonb DEFAULT '{}'::jsonb,
  skipped_keys jsonb DEFAULT '[]'::jsonb,
  created_at text NOT NULL,
  FOREIGN KEY(workspace_id, student_id) REFERENCES bao_an.students(workspace_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_contest_sessions_student ON bao_an.contest_sessions(workspace_id, student_id, created_at);
CREATE INDEX IF NOT EXISTS idx_contest_sessions_request ON bao_an.contest_sessions(workspace_id, student_id, request_id);

DO $$ DECLARE table_name text; BEGIN
  FOR table_name IN SELECT tablename FROM pg_tables WHERE schemaname='bao_an' AND tablename IN ('contest_sessions') LOOP
    EXECUTE format('ALTER TABLE bao_an.%I ENABLE ROW LEVEL SECURITY', table_name);
  END LOOP;
END $$;
INSERT INTO bao_an.schema_version VALUES(5) ON CONFLICT DO NOTHING;
