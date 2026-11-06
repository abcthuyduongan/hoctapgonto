-- Migration: 202611050004_parent_portal.sql
-- Parent portal, parent role, screen time controls, PIN security and parent-student links for Tuần 6

-- Update users role check to allow 'parent'
ALTER TABLE bao_an.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE bao_an.users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'student', 'parent'));

-- Update check constraint for student_id to allow role='parent' with student_id IS NULL
DO $$ DECLARE cname text; BEGIN
  FOR cname IN SELECT conname FROM pg_constraint WHERE conrelid='bao_an.users'::regclass AND contype='c' AND pg_get_constraintdef(oid) LIKE '%student_id%' LOOP
    EXECUTE format('ALTER TABLE bao_an.users DROP CONSTRAINT %I', cname);
  END LOOP;
END $$;
ALTER TABLE bao_an.users ADD CONSTRAINT users_student_role_check CHECK(
  (role='student' AND student_id IS NOT NULL) OR 
  (role IN ('admin', 'parent') AND student_id IS NULL)
);

-- Parent controls table (PIN, screen time, allowed hours)
CREATE TABLE IF NOT EXISTS bao_an.parent_controls(
  workspace_id text NOT NULL,
  student_id text NOT NULL,
  pin_hash text,
  pin_salt text,
  pin_failed_count integer NOT NULL DEFAULT 0 CHECK(pin_failed_count >= 0),
  pin_locked_until text,
  max_minutes_per_day integer NOT NULL DEFAULT 0 CHECK(max_minutes_per_day >= 0),
  allowed_start_hour integer NOT NULL DEFAULT 0 CHECK(allowed_start_hour >= 0 AND allowed_start_hour <= 23),
  allowed_end_hour integer NOT NULL DEFAULT 24 CHECK(allowed_end_hour >= 1 AND allowed_end_hour <= 24),
  updated_at text NOT NULL,
  PRIMARY KEY(workspace_id, student_id),
  FOREIGN KEY(workspace_id, student_id) REFERENCES bao_an.students(workspace_id, id) ON DELETE CASCADE
);

-- Parent-student link table
CREATE TABLE IF NOT EXISTS bao_an.parent_students(
  workspace_id text NOT NULL,
  parent_user_id text NOT NULL,
  student_id text NOT NULL,
  created_at text NOT NULL,
  PRIMARY KEY(workspace_id, parent_user_id, student_id),
  FOREIGN KEY(workspace_id, student_id) REFERENCES bao_an.students(workspace_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_parent_students_parent ON bao_an.parent_students(workspace_id, parent_user_id);
CREATE INDEX IF NOT EXISTS idx_parent_controls_student ON bao_an.parent_controls(workspace_id, student_id);

DO $$ DECLARE table_name text; api_role text; BEGIN
  FOR table_name IN SELECT tablename FROM pg_tables WHERE schemaname='bao_an' AND tablename IN ('parent_controls', 'parent_students') LOOP
    EXECUTE format('ALTER TABLE bao_an.%I ENABLE ROW LEVEL SECURITY', table_name);
  END LOOP;
  FOR api_role IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated', 'service_role') LOOP
    EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA bao_an FROM %I', api_role);
  END LOOP;
END $$;

REVOKE ALL ON ALL TABLES IN SCHEMA bao_an FROM PUBLIC;
INSERT INTO bao_an.schema_version VALUES(4) ON CONFLICT DO NOTHING;
