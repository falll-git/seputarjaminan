CREATE TABLE aggregate_cursors (
  id UUID NOT NULL,
  institution_id UUID NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id UUID NOT NULL,
  aggregate_version INTEGER NOT NULL,
  expected_state TEXT NOT NULL,
  payload_checksum CHAR(64) NOT NULL,
  updated_at TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT aggregate_cursors_pkey PRIMARY KEY (id),
  CONSTRAINT aggregate_cursors_institution_id_fkey
    FOREIGN KEY (institution_id) REFERENCES institutions(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT aggregate_cursors_version_positive CHECK (aggregate_version > 0),
  CONSTRAINT aggregate_cursors_checksum_format CHECK (payload_checksum ~ '^[a-f0-9]{64}$')
);

CREATE UNIQUE INDEX aggregate_cursors_institution_id_aggregate_id_key
  ON aggregate_cursors(institution_id, aggregate_id);
CREATE INDEX aggregate_cursors_institution_id_aggregate_type_expected_st_idx
  ON aggregate_cursors(institution_id, aggregate_type, expected_state);

ALTER TABLE aggregate_cursors ENABLE ROW LEVEL SECURITY;
ALTER TABLE aggregate_cursors FORCE ROW LEVEL SECURITY;
CREATE POLICY aggregate_cursors_private_policy ON aggregate_cursors
  FOR ALL TO PUBLIC
  USING (sj_can_access_institution(institution_id))
  WITH CHECK (sj_can_access_institution(institution_id));

GRANT SELECT, INSERT, UPDATE ON aggregate_cursors TO sj_ingest;
GRANT SELECT ON aggregate_cursors TO sj_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON aggregate_cursors TO sj_ops;
