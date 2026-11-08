-- Additive provenance only. Legacy rows remain NULL; current registry is not
-- evidence of the installation that originally created a job or upload.
ALTER TABLE media_objects ADD COLUMN origin_installation_id uuid;
ALTER TABLE central_jobs ADD COLUMN origin_installation_id uuid;
ALTER TABLE media_objects ADD CONSTRAINT media_origin_installation_fkey
  FOREIGN KEY (institution_id, origin_installation_id)
  REFERENCES institution_installations(institution_id,id) ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE central_jobs ADD CONSTRAINT job_origin_installation_fkey
  FOREIGN KEY (institution_id, origin_installation_id)
  REFERENCES institution_installations(institution_id,id) ON DELETE RESTRICT ON UPDATE NO ACTION;
ALTER TABLE central_jobs ADD CONSTRAINT job_origin_institution_required
  CHECK (origin_installation_id IS NULL OR institution_id IS NOT NULL);

CREATE FUNCTION sj_preserve_media_origin() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.origin_installation_id IS DISTINCT FROM OLD.origin_installation_id
     OR NEW.institution_id IS DISTINCT FROM OLD.institution_id
     OR NEW.source_media_id IS DISTINCT FROM OLD.source_media_id THEN
    RAISE EXCEPTION 'MEDIA_ORIGIN_IMMUTABLE' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER media_origin_immutable BEFORE UPDATE ON media_objects
  FOR EACH ROW EXECUTE FUNCTION sj_preserve_media_origin();

CREATE FUNCTION sj_preserve_job_origin() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.origin_installation_id IS DISTINCT FROM OLD.origin_installation_id
     OR NEW.institution_id IS DISTINCT FROM OLD.institution_id
     OR NEW.job_type IS DISTINCT FROM OLD.job_type
     OR NEW.dedupe_key IS DISTINCT FROM OLD.dedupe_key
     OR NEW.payload IS DISTINCT FROM OLD.payload THEN
    RAISE EXCEPTION 'JOB_ORIGIN_IMMUTABLE' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER job_origin_immutable BEFORE UPDATE ON central_jobs
  FOR EACH ROW EXECUTE FUNCTION sj_preserve_job_origin();
