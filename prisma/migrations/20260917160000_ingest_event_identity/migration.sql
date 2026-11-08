-- Additive: old events did not retain occurred_at. NULL explicitly denotes
-- legacy identity coverage; no fabricated backfill and no change to payloads.
ALTER TABLE ingest_events ADD COLUMN identity_checksum CHAR(64);
ALTER TABLE ingest_events ADD CONSTRAINT ingest_event_identity_checksum_valid
  CHECK (identity_checksum IS NULL OR identity_checksum ~ '^[a-f0-9]{64}$');
