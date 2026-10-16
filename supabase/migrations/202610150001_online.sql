-- Run as the database owner (normally postgres), through cloud:setup or SQL Editor.
-- Private server-owned data. This schema must not be added to the Data API's exposed schemas.
-- Reapplying this migration preserves accounts, classes, questions, media and progress.
-- No sample account, subject, question or student is inserted.
CREATE SCHEMA IF NOT EXISTS bao_an;
REVOKE ALL ON SCHEMA bao_an FROM PUBLIC;
-- Schema-local defaults undo schema-local grants, not global grants. Revoke on
-- existing objects again below and after any future migration adds objects.
ALTER DEFAULT PRIVILEGES IN SCHEMA bao_an REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA bao_an REVOKE ALL ON SEQUENCES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA bao_an REVOKE ALL ON FUNCTIONS FROM PUBLIC;

CREATE TABLE IF NOT EXISTS bao_an.schema_version(version integer PRIMARY KEY CHECK(version=1));
INSERT INTO bao_an.schema_version VALUES(1) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS bao_an.workspaces(
  id text PRIMARY KEY,name text NOT NULL,wallet_enabled boolean NOT NULL DEFAULT false,
  rate_vnd integer NOT NULL DEFAULT 1000 CHECK(rate_vnd BETWEEN 1 AND 1000000),created_at text NOT NULL
);
CREATE TABLE IF NOT EXISTS bao_an.users(
  id text PRIMARY KEY,workspace_id text NOT NULL REFERENCES bao_an.workspaces(id),
  username text NOT NULL UNIQUE,password_hash text NOT NULL,role text NOT NULL CHECK(role IN ('admin','student')),
  student_id text,active boolean NOT NULL DEFAULT true,created_at text NOT NULL,
  UNIQUE(workspace_id,id),CHECK((role='student' AND student_id IS NOT NULL) OR (role='admin' AND student_id IS NULL))
);
CREATE TABLE IF NOT EXISTS bao_an.auth_sessions(
  token_hash text PRIMARY KEY CHECK(length(token_hash)=64),user_id text NOT NULL REFERENCES bao_an.users(id),
  csrf_token text NOT NULL,expires_at bigint NOT NULL
);
CREATE TABLE IF NOT EXISTS bao_an.login_limits(
  key text PRIMARY KEY,count integer NOT NULL CHECK(count>=0),reset_at bigint NOT NULL
);
CREATE TABLE IF NOT EXISTS bao_an.classes(
  id text NOT NULL,workspace_id text NOT NULL REFERENCES bao_an.workspaces(id),name text NOT NULL,
  grade integer NOT NULL CHECK(grade BETWEEN 1 AND 12),created_at text NOT NULL,PRIMARY KEY(workspace_id,id)
);
CREATE TABLE IF NOT EXISTS bao_an.students(
  id text NOT NULL,workspace_id text NOT NULL,class_id text NOT NULL,name text NOT NULL,
  user_id text NOT NULL,active boolean NOT NULL DEFAULT true,created_at text NOT NULL,PRIMARY KEY(workspace_id,id),
  UNIQUE(workspace_id,user_id),FOREIGN KEY(workspace_id,class_id) REFERENCES bao_an.classes(workspace_id,id),
  FOREIGN KEY(workspace_id,user_id) REFERENCES bao_an.users(workspace_id,id)
);
-- The deferred reverse link permits atomically creating a student and its login.
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conname='users_student_workspace_fk' AND connamespace='bao_an'::regnamespace) THEN
    ALTER TABLE bao_an.users ADD CONSTRAINT users_student_workspace_fk FOREIGN KEY(workspace_id,student_id)
      REFERENCES bao_an.students(workspace_id,id) DEFERRABLE INITIALLY DEFERRED;
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS bao_an.packs(
  workspace_id text NOT NULL REFERENCES bao_an.workspaces(id),pack_id text NOT NULL,version integer NOT NULL CHECK(version>0),
  subject_label text NOT NULL,json jsonb NOT NULL,content_hash text NOT NULL,PRIMARY KEY(workspace_id,pack_id,version)
);
CREATE TABLE IF NOT EXISTS bao_an.weeks(
  id text NOT NULL,workspace_id text NOT NULL,class_id text NOT NULL,title text NOT NULL,position integer NOT NULL CHECK(position>0),
  request_id text NOT NULL,payload_hash text NOT NULL,created_at text NOT NULL,PRIMARY KEY(workspace_id,id),
  UNIQUE(workspace_id,request_id),UNIQUE(workspace_id,class_id,position),
  FOREIGN KEY(workspace_id,class_id) REFERENCES bao_an.classes(workspace_id,id)
);
CREATE TABLE IF NOT EXISTS bao_an.week_sets(
  workspace_id text NOT NULL,week_id text NOT NULL,position integer NOT NULL CHECK(position>0),pack_id text NOT NULL,version integer NOT NULL,
  PRIMARY KEY(workspace_id,week_id,position),UNIQUE(workspace_id,week_id,pack_id),
  FOREIGN KEY(workspace_id,week_id) REFERENCES bao_an.weeks(workspace_id,id),
  FOREIGN KEY(workspace_id,pack_id,version) REFERENCES bao_an.packs(workspace_id,pack_id,version)
);
CREATE TABLE IF NOT EXISTS bao_an.plays(
  id text NOT NULL,workspace_id text NOT NULL,student_id text NOT NULL,request_id text NOT NULL,json jsonb NOT NULL,
  PRIMARY KEY(workspace_id,id),UNIQUE(workspace_id,student_id,request_id),
  FOREIGN KEY(workspace_id,student_id) REFERENCES bao_an.students(workspace_id,id)
);
CREATE TABLE IF NOT EXISTS bao_an.attempts(
  workspace_id text NOT NULL,play_id text NOT NULL,attempt_key text NOT NULL,payload_hash text NOT NULL,json jsonb NOT NULL,
  sequence integer NOT NULL CHECK(sequence>0),PRIMARY KEY(workspace_id,play_id,attempt_key),UNIQUE(workspace_id,play_id,sequence),
  FOREIGN KEY(workspace_id,play_id) REFERENCES bao_an.plays(workspace_id,id)
);
CREATE TABLE IF NOT EXISTS bao_an.awards(
  workspace_id text NOT NULL,student_id text NOT NULL,pack_id text NOT NULL,tier integer NOT NULL CHECK(tier BETWEEN 1 AND 3),json jsonb NOT NULL,
  PRIMARY KEY(workspace_id,student_id,pack_id),FOREIGN KEY(workspace_id,student_id) REFERENCES bao_an.students(workspace_id,id)
);
CREATE TABLE IF NOT EXISTS bao_an.redemptions(
  workspace_id text NOT NULL,id text NOT NULL,student_id text NOT NULL,status text NOT NULL CHECK(status IN ('pending','approved','fulfilled','cancelled','rejected')),
  json jsonb NOT NULL,created_order bigint GENERATED ALWAYS AS IDENTITY,PRIMARY KEY(workspace_id,id),
  FOREIGN KEY(workspace_id,student_id) REFERENCES bao_an.students(workspace_id,id)
);
CREATE TABLE IF NOT EXISTS bao_an.audit(
  id text PRIMARY KEY,workspace_id text NOT NULL,user_id text NOT NULL,action text NOT NULL,target_id text NOT NULL,at text NOT NULL,
  FOREIGN KEY(workspace_id,user_id) REFERENCES bao_an.users(workspace_id,id)
);
CREATE TABLE IF NOT EXISTS bao_an.media(
  id text NOT NULL,workspace_id text NOT NULL REFERENCES bao_an.workspaces(id),name text NOT NULL,mime text NOT NULL,
  kind text NOT NULL CHECK(kind IN ('image','audio')),size integer NOT NULL CHECK(size BETWEEN 12 AND 2097152),
  sha256 text NOT NULL CHECK(length(sha256)=64),object_path text NOT NULL UNIQUE,created_at text NOT NULL,
  PRIMARY KEY(workspace_id,id),UNIQUE(workspace_id,name,sha256)
);
CREATE INDEX IF NOT EXISTS plays_student ON bao_an.plays(workspace_id,student_id);
CREATE INDEX IF NOT EXISTS redemption_student ON bao_an.redemptions(workspace_id,student_id);
CREATE INDEX IF NOT EXISTS auth_expiry ON bao_an.auth_sessions(expires_at);
CREATE INDEX IF NOT EXISTS login_limit_expiry ON bao_an.login_limits(reset_at);
CREATE INDEX IF NOT EXISTS student_class ON bao_an.students(workspace_id,class_id);

-- The application authorizes tenants and students in its server API. It connects
-- directly with the owning database role; Supabase Auth/Data API is not used.
-- Even service_role is only needed for private Storage, not for these SQL tables.
DO $$ DECLARE table_name text; api_role text; BEGIN
  FOR table_name IN SELECT tablename FROM pg_tables WHERE schemaname='bao_an' LOOP
    EXECUTE format('ALTER TABLE bao_an.%I ENABLE ROW LEVEL SECURITY',table_name);
  END LOOP;
  FOR api_role IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role') LOOP
    EXECUTE format('REVOKE ALL ON SCHEMA bao_an FROM %I',api_role);
    EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA bao_an FROM %I',api_role);
    EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA bao_an FROM %I',api_role);
    EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA bao_an FROM %I',api_role);
    -- Undo schema-local default grants left by a previous manual setup.
    -- Global default privileges are deliberately not changed for other apps.
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA bao_an REVOKE ALL ON TABLES FROM %I',api_role);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA bao_an REVOKE ALL ON SEQUENCES FROM %I',api_role);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA bao_an REVOKE ALL ON FUNCTIONS FROM %I',api_role);
  END LOOP;
END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA bao_an FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA bao_an FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA bao_an FROM PUBLIC;
