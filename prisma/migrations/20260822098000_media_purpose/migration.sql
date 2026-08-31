CREATE TYPE media_purpose AS ENUM ('PUBLICATION_IMAGE', 'BPRS_PUBLIC_MARK');

ALTER TABLE media_objects ADD COLUMN purpose media_purpose;

UPDATE media_objects
   SET purpose = CASE
     WHEN source_publication_id IS NULL THEN 'BPRS_PUBLIC_MARK'::media_purpose
     ELSE 'PUBLICATION_IMAGE'::media_purpose
   END;

ALTER TABLE media_objects ALTER COLUMN purpose SET NOT NULL;
