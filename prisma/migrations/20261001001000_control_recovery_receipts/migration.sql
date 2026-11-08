-- Separate audit for signed Control recovery; no impersonated OpsUser FK.
CREATE TABLE control_recovery_receipts (
  request_id uuid PRIMARY KEY,
  institution_id uuid NOT NULL REFERENCES institutions(id) ON DELETE RESTRICT,
  installation_id uuid NOT NULL,
  control_instance_id uuid NOT NULL,
  operator_id uuid NOT NULL,
  job_id uuid NOT NULL REFERENCES central_jobs(id) ON DELETE RESTRICT,
  binding_digest char(64) NOT NULL CHECK(binding_digest ~ '^[a-f0-9]{64}$'),
  request_digest char(64) NOT NULL CHECK(request_digest ~ '^[a-f0-9]{64}$'),
  previous_attempt_count integer NOT NULL CHECK(previous_attempt_count>=0),
  reason text NOT NULL CHECK(length(reason) BETWEEN 5 AND 500),
  result_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY(institution_id,installation_id) REFERENCES institution_installations(institution_id,id) ON DELETE RESTRICT
);
ALTER TABLE control_recovery_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE control_recovery_receipts FORCE ROW LEVEL SECURITY;
CREATE POLICY control_recovery_receipts_tenant ON control_recovery_receipts
  USING (sj_has_database_role('sj_ingest') AND institution_id=sj_current_institution_id())
  WITH CHECK (sj_has_database_role('sj_ingest') AND institution_id=sj_current_institution_id());
GRANT SELECT,INSERT ON control_recovery_receipts TO sj_ingest;
-- No runtime UPDATE/DELETE. Original attempts and the retry reason remain auditable.
CREATE INDEX control_recovery_receipts_job ON control_recovery_receipts(institution_id,installation_id,job_id,created_at);
