-- Migration: 202611050003_badges.sql
-- Badges, student streaks, and daily missions schema for Tuần 4

CREATE TABLE IF NOT EXISTS bao_an.badge_awards(
  workspace_id text NOT NULL,
  student_id text NOT NULL,
  badge_id text NOT NULL,
  unlocked_at text NOT NULL,
  json text NOT NULL DEFAULT '{}',
  PRIMARY KEY(workspace_id, student_id, badge_id),
  FOREIGN KEY(workspace_id, student_id) REFERENCES bao_an.students(workspace_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bao_an.student_streaks(
  workspace_id text NOT NULL,
  student_id text NOT NULL,
  current_streak integer NOT NULL DEFAULT 0 CHECK(current_streak >= 0),
  longest_streak integer NOT NULL DEFAULT 0 CHECK(longest_streak >= 0),
  last_active_date text,
  freeze_used_week text,
  today_correct_count integer NOT NULL DEFAULT 0 CHECK(today_correct_count >= 0),
  today_date text,
  updated_at text NOT NULL,
  PRIMARY KEY(workspace_id, student_id),
  FOREIGN KEY(workspace_id, student_id) REFERENCES bao_an.students(workspace_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bao_an.daily_missions(
  workspace_id text NOT NULL,
  student_id text NOT NULL,
  date text NOT NULL,
  mission_id text NOT NULL,
  mission_type text NOT NULL,
  target_count integer NOT NULL DEFAULT 1,
  progress_count integer NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  completed_at text,
  json text NOT NULL DEFAULT '{}',
  PRIMARY KEY(workspace_id, student_id, date, mission_id),
  FOREIGN KEY(workspace_id, student_id) REFERENCES bao_an.students(workspace_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_badge_awards_student ON bao_an.badge_awards(workspace_id, student_id);
CREATE INDEX IF NOT EXISTS idx_daily_missions_date ON bao_an.daily_missions(workspace_id, student_id, date);

DO $$ DECLARE table_name text; api_role text; BEGIN
  FOR table_name IN SELECT tablename FROM pg_tables WHERE schemaname='bao_an' AND tablename IN ('badge_awards', 'student_streaks', 'daily_missions') LOOP
    EXECUTE format('ALTER TABLE bao_an.%I ENABLE ROW LEVEL SECURITY', table_name);
  END LOOP;
  FOR api_role IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated', 'service_role') LOOP
    EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA bao_an FROM %I', api_role);
  END LOOP;
END $$;

REVOKE ALL ON ALL TABLES IN SCHEMA bao_an FROM PUBLIC;
INSERT INTO bao_an.schema_version VALUES(3) ON CONFLICT DO NOTHING;
