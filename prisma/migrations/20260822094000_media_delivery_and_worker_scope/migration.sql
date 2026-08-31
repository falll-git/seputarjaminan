ALTER TABLE media_objects
  ADD COLUMN delivery_object_key TEXT,
  ADD COLUMN delivery_mime TEXT,
  ADD COLUMN delivery_sha256 CHAR(64),
  ADD COLUMN delivery_size_bytes BIGINT,
  ADD COLUMN delivery_width INTEGER,
  ADD COLUMN delivery_height INTEGER,
  ADD CONSTRAINT media_delivery_complete CHECK (
    (delivery_object_key IS NULL
      AND delivery_mime IS NULL
      AND delivery_sha256 IS NULL
      AND delivery_size_bytes IS NULL
      AND delivery_width IS NULL
      AND delivery_height IS NULL)
    OR
    (delivery_object_key IS NOT NULL
      AND delivery_mime IS NOT NULL
      AND delivery_sha256 ~ '^[a-f0-9]{64}$'
      AND delivery_size_bytes > 0
      AND delivery_width > 0
      AND delivery_height > 0)
  ),
  ADD CONSTRAINT media_ready_has_delivery CHECK (
    state <> 'READY'
    OR (
      delivery_object_key IS NOT NULL
      AND delivery_mime IS NOT NULL
      AND delivery_sha256 IS NOT NULL
      AND delivery_size_bytes IS NOT NULL
      AND delivery_width IS NOT NULL
      AND delivery_height IS NOT NULL
    )
  );

CREATE OR REPLACE FUNCTION sj_can_access_institution(row_institution_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $function$
  SELECT
    sj_has_database_role('sj_ops')
    OR sj_has_database_role('sj_worker')
    OR (
      sj_has_database_role('sj_ingest')
      AND row_institution_id = sj_current_institution_id()
    )
$function$;
