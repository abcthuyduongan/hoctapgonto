-- Migration 0007: Town Animal Neighbors, Classmate Cheers, and Class Bulletin Feed
-- Reapplying this migration preserves all animal assignments, cheer history, and feed events.

DO $$ BEGIN
  IF NOT EXISTS(
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'bao_an' AND table_name = 'classes' AND column_name = 'feed_enabled'
  ) THEN
    ALTER TABLE bao_an.classes ADD COLUMN feed_enabled boolean NOT NULL DEFAULT true;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS bao_an.town_animals(
  workspace_id text NOT NULL,
  student_id text NOT NULL,
  animal_id text NOT NULL,
  name text NOT NULL,
  arrived_at_week integer NOT NULL,
  created_at text NOT NULL,
  PRIMARY KEY(workspace_id, student_id, animal_id),
  FOREIGN KEY(workspace_id, student_id) REFERENCES bao_an.students(workspace_id, id)
);

CREATE TABLE IF NOT EXISTS bao_an.town_cheers(
  workspace_id text NOT NULL,
  from_student_id text NOT NULL,
  to_student_id text NOT NULL,
  day_key text NOT NULL,
  created_at text NOT NULL,
  PRIMARY KEY(workspace_id, from_student_id, to_student_id, day_key),
  FOREIGN KEY(workspace_id, from_student_id) REFERENCES bao_an.students(workspace_id, id),
  FOREIGN KEY(workspace_id, to_student_id) REFERENCES bao_an.students(workspace_id, id)
);

CREATE TABLE IF NOT EXISTS bao_an.class_feed_events(
  workspace_id text NOT NULL,
  class_id text NOT NULL,
  id text NOT NULL,
  student_id text NOT NULL,
  student_name text NOT NULL,
  event_type text NOT NULL,
  details_json text NOT NULL,
  created_at text NOT NULL,
  PRIMARY KEY(workspace_id, class_id, id),
  FOREIGN KEY(workspace_id, class_id) REFERENCES bao_an.classes(workspace_id, id)
);

CREATE INDEX IF NOT EXISTS town_animals_student ON bao_an.town_animals(workspace_id, student_id);
CREATE INDEX IF NOT EXISTS town_cheers_target ON bao_an.town_cheers(workspace_id, to_student_id);
CREATE INDEX IF NOT EXISTS class_feed_lookup ON bao_an.class_feed_events(workspace_id, class_id, created_at DESC);

ALTER TABLE bao_an.town_animals ENABLE ROW LEVEL SECURITY;
ALTER TABLE bao_an.town_cheers ENABLE ROW LEVEL SECURITY;
ALTER TABLE bao_an.class_feed_events ENABLE ROW LEVEL SECURITY;
