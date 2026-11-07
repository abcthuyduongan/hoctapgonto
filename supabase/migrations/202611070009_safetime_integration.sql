-- Migration 0009: SafeTime integration tables, pairing codes, tickets, refresh tokens and events (BAO-04, BAO-14)
-- Reapplying this migration preserves all data, indexes and RLS privileges.

CREATE TABLE IF NOT EXISTS bao_an.integration_clients(
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES bao_an.workspaces(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  device_id text NOT NULL,
  device_name text NOT NULL,
  allowed_student_ids text NOT NULL,
  created_at text NOT NULL,
  last_used_at text,
  revoked_at text
);

CREATE TABLE IF NOT EXISTS bao_an.integration_pair_codes(
  code text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES bao_an.workspaces(id) ON DELETE CASCADE,
  allowed_student_ids text NOT NULL,
  created_at text NOT NULL,
  expires_at text NOT NULL,
  used_at text
);

CREATE TABLE IF NOT EXISTS bao_an.integration_tickets(
  ticket text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES bao_an.workspaces(id) ON DELETE CASCADE,
  client_id text NOT NULL REFERENCES bao_an.integration_clients(id) ON DELETE CASCADE,
  student_id text NOT NULL,
  created_at text NOT NULL,
  expires_at text NOT NULL,
  used_at text,
  FOREIGN KEY(workspace_id, student_id) REFERENCES bao_an.students(workspace_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bao_an.integration_refresh_tokens(
  token_hash text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES bao_an.workspaces(id) ON DELETE CASCADE,
  client_id text NOT NULL REFERENCES bao_an.integration_clients(id) ON DELETE CASCADE,
  student_id text NOT NULL,
  created_at text NOT NULL,
  expires_at text NOT NULL,
  revoked_at text,
  FOREIGN KEY(workspace_id, student_id) REFERENCES bao_an.students(workspace_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bao_an.integration_events(
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES bao_an.workspaces(id) ON DELETE CASCADE,
  student_id text NOT NULL,
  event_type text NOT NULL,
  data_json text NOT NULL,
  created_at text NOT NULL,
  FOREIGN KEY(workspace_id, student_id) REFERENCES bao_an.students(workspace_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_integration_clients_token ON bao_an.integration_clients(token_hash);
CREATE INDEX IF NOT EXISTS idx_integration_pair_codes_expiry ON bao_an.integration_pair_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_integration_tickets_lookup ON bao_an.integration_tickets(ticket, expires_at);
CREATE INDEX IF NOT EXISTS idx_integration_refresh_lookup ON bao_an.integration_refresh_tokens(token_hash, expires_at);
CREATE INDEX IF NOT EXISTS idx_integration_events_lookup ON bao_an.integration_events(workspace_id, student_id, created_at);

DO $$ DECLARE table_name text; api_role text; BEGIN
  FOR table_name IN SELECT tablename FROM pg_tables WHERE schemaname='bao_an' AND tablename IN (
    'integration_clients', 'integration_pair_codes', 'integration_tickets', 'integration_refresh_tokens', 'integration_events'
  ) LOOP
    EXECUTE format('ALTER TABLE bao_an.%I ENABLE ROW LEVEL SECURITY', table_name);
  END LOOP;
  FOR api_role IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated', 'service_role') LOOP
    EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA bao_an FROM %I', api_role);
  END LOOP;
END $$;

REVOKE ALL ON ALL TABLES IN SCHEMA bao_an FROM PUBLIC;
INSERT INTO bao_an.schema_version VALUES(9) ON CONFLICT DO NOTHING;
