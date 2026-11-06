-- Migration: 202611050006_town.sql
-- Town grid 10x10 and materials ledger by subject (Tuần 8 - Cổng C8)

CREATE TABLE IF NOT EXISTS bao_an.town_states(
  workspace_id text NOT NULL,
  student_id text NOT NULL,
  grid_width integer NOT NULL DEFAULT 10,
  grid_height integer NOT NULL DEFAULT 10,
  revision integer NOT NULL DEFAULT 1,
  buildings_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at text NOT NULL,
  PRIMARY KEY (workspace_id, student_id),
  FOREIGN KEY (workspace_id, student_id) REFERENCES bao_an.students(workspace_id, id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bao_an.materials_ledger(
  workspace_id text NOT NULL,
  student_id text NOT NULL,
  id text PRIMARY KEY,
  pack_id text,
  material_type text NOT NULL CHECK (material_type IN ('stone', 'wood', 'fish', 'component')),
  delta integer NOT NULL,
  reason text NOT NULL,
  request_id text,
  created_at text NOT NULL,
  FOREIGN KEY (workspace_id, student_id) REFERENCES bao_an.students(workspace_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_town_states_student ON bao_an.town_states(workspace_id, student_id);
CREATE INDEX IF NOT EXISTS idx_materials_student ON bao_an.materials_ledger(workspace_id, student_id);
CREATE INDEX IF NOT EXISTS idx_materials_request ON bao_an.materials_ledger(workspace_id, student_id, request_id);

DO $$ DECLARE table_name text; BEGIN
  FOR table_name IN SELECT tablename FROM pg_tables WHERE schemaname='bao_an' AND tablename IN ('town_states', 'materials_ledger') LOOP
    EXECUTE format('ALTER TABLE bao_an.%I ENABLE ROW LEVEL SECURITY', table_name);
  END LOOP;
END $$;
INSERT INTO bao_an.schema_version VALUES(6) ON CONFLICT DO NOTHING;
