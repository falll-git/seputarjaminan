ALTER TYPE media_state ADD VALUE IF NOT EXISTS 'QUARANTINED';

ALTER TABLE quarantine_records
  ADD COLUMN previous_state TEXT NOT NULL DEFAULT 'UNKNOWN';

ALTER TABLE quarantine_records
  ALTER COLUMN previous_state DROP DEFAULT;

CREATE UNIQUE INDEX quarantine_records_one_active_subject_idx
  ON quarantine_records(institution_id, subject_type, subject_id)
  WHERE state = 'ACTIVE';
