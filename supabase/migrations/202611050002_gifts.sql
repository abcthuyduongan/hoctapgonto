-- Migration: 202611050002_gifts.sql
-- Gift catalog and student goals schema for Tuần 3

CREATE TABLE IF NOT EXISTS bao_an.gift_catalog(
  workspace_id text NOT NULL REFERENCES bao_an.workspaces(id),
  id text NOT NULL,
  class_id text,
  title text NOT NULL,
  image_media_id text,
  price_stars integer NOT NULL CHECK(price_stars > 0),
  kind text NOT NULL CHECK(kind IN ('item', 'experience', 'privilege', 'saving')),
  weekly_limit integer NOT NULL DEFAULT 0 CHECK(weekly_limit >= 0),
  stock integer NOT NULL DEFAULT -1 CHECK(stock >= -1),
  unlock_after_week integer NOT NULL DEFAULT 0 CHECK(unlock_after_week >= 0),
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at text NOT NULL,
  PRIMARY KEY(workspace_id, id),
  FOREIGN KEY(workspace_id, class_id) REFERENCES bao_an.classes(workspace_id, id)
);

CREATE TABLE IF NOT EXISTS bao_an.student_goals(
  workspace_id text NOT NULL,
  student_id text NOT NULL,
  gift_id text NOT NULL,
  pinned_at text NOT NULL,
  PRIMARY KEY(workspace_id, student_id),
  FOREIGN KEY(workspace_id, student_id) REFERENCES bao_an.students(workspace_id, id)
);

CREATE INDEX IF NOT EXISTS gift_workspace_active ON bao_an.gift_catalog(workspace_id, active, sort_order);
CREATE INDEX IF NOT EXISTS gift_class ON bao_an.gift_catalog(workspace_id, class_id);
CREATE INDEX IF NOT EXISTS student_goal_gift ON bao_an.student_goals(workspace_id, gift_id);

DO $$ DECLARE table_name text; api_role text; BEGIN
  FOR table_name IN SELECT tablename FROM pg_tables WHERE schemaname='bao_an' AND tablename IN ('gift_catalog', 'student_goals') LOOP
    EXECUTE format('ALTER TABLE bao_an.%I ENABLE ROW LEVEL SECURITY', table_name);
  END LOOP;
  FOR api_role IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated', 'service_role') LOOP
    EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA bao_an FROM %I', api_role);
  END LOOP;
END $$;

REVOKE ALL ON ALL TABLES IN SCHEMA bao_an FROM PUBLIC;
ALTER TABLE bao_an.schema_version DROP CONSTRAINT IF EXISTS schema_version_version_check;
INSERT INTO bao_an.schema_version VALUES(2) ON CONFLICT DO NOTHING;
