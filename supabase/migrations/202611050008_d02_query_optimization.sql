-- Migration 0008: D02 Cumulative progress query optimization and indexing for 1-year dataset
-- Reapplying this migration preserves all data, indexes and RLS privileges.

CREATE INDEX IF NOT EXISTS idx_audit_user_action ON bao_an.audit(workspace_id, user_id, action);
CREATE INDEX IF NOT EXISTS idx_redemptions_order ON bao_an.redemptions(workspace_id, student_id, created_order);
CREATE INDEX IF NOT EXISTS idx_materials_student ON bao_an.materials_ledger(workspace_id, student_id);
CREATE INDEX IF NOT EXISTS idx_town_state_student ON bao_an.town_states(workspace_id, student_id);
CREATE INDEX IF NOT EXISTS idx_awards_student_tier ON bao_an.awards(workspace_id, student_id, tier);
CREATE INDEX IF NOT EXISTS idx_weeks_class_position ON bao_an.weeks(workspace_id, class_id, position);
INSERT INTO bao_an.schema_version VALUES(8) ON CONFLICT DO NOTHING;
