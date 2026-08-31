-- Tenant context is transaction-local and must be set after authentication.
CREATE OR REPLACE FUNCTION sj_current_institution_id()
RETURNS uuid
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $function$
  SELECT NULLIF(current_setting('app.current_institution_id', true), '')::uuid
$function$;

CREATE OR REPLACE FUNCTION sj_has_database_role(required_role text)
RETURNS boolean
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $function$
  SELECT pg_has_role(current_user, required_role, 'member')
$function$;

CREATE OR REPLACE FUNCTION sj_can_access_institution(row_institution_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $function$
  SELECT
    sj_has_database_role('sj_ops')
    OR (
      (sj_has_database_role('sj_ingest') OR sj_has_database_role('sj_worker'))
      AND row_institution_id = sj_current_institution_id()
    )
$function$;

ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE institutions FORCE ROW LEVEL SECURITY;
CREATE POLICY institutions_private_policy ON institutions
  FOR ALL TO PUBLIC
  USING (sj_can_access_institution(id))
  WITH CHECK (sj_can_access_institution(id));
CREATE POLICY institutions_public_policy ON institutions
  FOR SELECT TO PUBLIC
  USING (sj_has_database_role('sj_public') AND state = 'ACTIVE');

ALTER TABLE institution_installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE institution_installations FORCE ROW LEVEL SECURITY;
CREATE POLICY institution_installations_private_policy ON institution_installations
  FOR ALL TO PUBLIC
  USING (sj_can_access_institution(institution_id))
  WITH CHECK (sj_can_access_institution(institution_id));

ALTER TABLE institution_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE institution_keys FORCE ROW LEVEL SECURITY;
CREATE POLICY institution_keys_private_policy ON institution_keys
  FOR ALL TO PUBLIC
  USING (sj_can_access_institution(institution_id))
  WITH CHECK (sj_can_access_institution(institution_id));

ALTER TABLE request_nonces ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_nonces FORCE ROW LEVEL SECURITY;
CREATE POLICY request_nonces_private_policy ON request_nonces
  FOR ALL TO PUBLIC
  USING (
    sj_has_database_role('sj_ops')
    OR EXISTS (
      SELECT 1 FROM institution_keys k
      WHERE k.key_id = request_nonces.key_id
        AND sj_can_access_institution(k.institution_id)
    )
  )
  WITH CHECK (
    sj_has_database_role('sj_ops')
    OR EXISTS (
      SELECT 1 FROM institution_keys k
      WHERE k.key_id = request_nonces.key_id
        AND sj_can_access_institution(k.institution_id)
    )
  );

ALTER TABLE bprs_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bprs_profiles FORCE ROW LEVEL SECURITY;
CREATE POLICY bprs_profiles_private_policy ON bprs_profiles
  FOR ALL TO PUBLIC
  USING (sj_can_access_institution(institution_id))
  WITH CHECK (sj_can_access_institution(institution_id));
CREATE POLICY bprs_profiles_public_policy ON bprs_profiles
  FOR SELECT TO PUBLIC
  USING (sj_has_database_role('sj_public') AND state = 'ACTIVE');

ALTER TABLE whatsapp_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_contacts FORCE ROW LEVEL SECURITY;
CREATE POLICY whatsapp_contacts_private_policy ON whatsapp_contacts
  FOR ALL TO PUBLIC
  USING (sj_can_access_institution(institution_id))
  WITH CHECK (sj_can_access_institution(institution_id));
CREATE POLICY whatsapp_contacts_public_policy ON whatsapp_contacts
  FOR SELECT TO PUBLIC
  USING (sj_has_database_role('sj_public') AND state = 'VERIFIED');

ALTER TABLE publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE publications FORCE ROW LEVEL SECURITY;
CREATE POLICY publications_private_policy ON publications
  FOR ALL TO PUBLIC
  USING (sj_can_access_institution(institution_id))
  WITH CHECK (sj_can_access_institution(institution_id));
CREATE POLICY publications_public_policy ON publications
  FOR SELECT TO PUBLIC
  USING (
    sj_has_database_role('sj_public')
    AND state = 'PUBLISHED'
    AND availability = 'AVAILABLE'
    AND next_reconfirmation_at > CURRENT_TIMESTAMP
  );

ALTER TABLE land_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE land_details FORCE ROW LEVEL SECURITY;
CREATE POLICY land_details_private_policy ON land_details
  FOR ALL TO PUBLIC
  USING (sj_can_access_institution(institution_id))
  WITH CHECK (sj_can_access_institution(institution_id));
CREATE POLICY land_details_public_policy ON land_details
  FOR SELECT TO PUBLIC
  USING (
    sj_has_database_role('sj_public')
    AND EXISTS (SELECT 1 FROM publications p WHERE p.id = publication_id)
  );

ALTER TABLE building_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE building_details FORCE ROW LEVEL SECURITY;
CREATE POLICY building_details_private_policy ON building_details
  FOR ALL TO PUBLIC
  USING (sj_can_access_institution(institution_id))
  WITH CHECK (sj_can_access_institution(institution_id));
CREATE POLICY building_details_public_policy ON building_details
  FOR SELECT TO PUBLIC
  USING (
    sj_has_database_role('sj_public')
    AND EXISTS (SELECT 1 FROM publications p WHERE p.id = publication_id)
  );

ALTER TABLE machine_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE machine_details FORCE ROW LEVEL SECURITY;
CREATE POLICY machine_details_private_policy ON machine_details
  FOR ALL TO PUBLIC
  USING (sj_can_access_institution(institution_id))
  WITH CHECK (sj_can_access_institution(institution_id));
CREATE POLICY machine_details_public_policy ON machine_details
  FOR SELECT TO PUBLIC
  USING (
    sj_has_database_role('sj_public')
    AND EXISTS (SELECT 1 FROM publications p WHERE p.id = publication_id)
  );

ALTER TABLE vehicle_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_details FORCE ROW LEVEL SECURITY;
CREATE POLICY vehicle_details_private_policy ON vehicle_details
  FOR ALL TO PUBLIC
  USING (sj_can_access_institution(institution_id))
  WITH CHECK (sj_can_access_institution(institution_id));
CREATE POLICY vehicle_details_public_policy ON vehicle_details
  FOR SELECT TO PUBLIC
  USING (
    sj_has_database_role('sj_public')
    AND EXISTS (SELECT 1 FROM publications p WHERE p.id = publication_id)
  );

ALTER TABLE media_objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_objects FORCE ROW LEVEL SECURITY;
CREATE POLICY media_objects_private_policy ON media_objects
  FOR ALL TO PUBLIC
  USING (sj_can_access_institution(institution_id))
  WITH CHECK (sj_can_access_institution(institution_id));
CREATE POLICY media_objects_public_policy ON media_objects
  FOR SELECT TO PUBLIC
  USING (sj_has_database_role('sj_public') AND state = 'READY');

ALTER TABLE publication_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE publication_media FORCE ROW LEVEL SECURITY;
CREATE POLICY publication_media_private_policy ON publication_media
  FOR ALL TO PUBLIC
  USING (sj_can_access_institution(institution_id))
  WITH CHECK (sj_can_access_institution(institution_id));
CREATE POLICY publication_media_public_policy ON publication_media
  FOR SELECT TO PUBLIC
  USING (
    sj_has_database_role('sj_public')
    AND EXISTS (SELECT 1 FROM publications p WHERE p.id = publication_id)
  );

ALTER TABLE media_upload_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_upload_sessions FORCE ROW LEVEL SECURITY;
CREATE POLICY media_upload_sessions_private_policy ON media_upload_sessions
  FOR ALL TO PUBLIC
  USING (sj_can_access_institution(institution_id))
  WITH CHECK (sj_can_access_institution(institution_id));

ALTER TABLE ingest_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingest_events FORCE ROW LEVEL SECURITY;
CREATE POLICY ingest_events_private_policy ON ingest_events
  FOR ALL TO PUBLIC
  USING (sj_can_access_institution(institution_id))
  WITH CHECK (sj_can_access_institution(institution_id));

ALTER TABLE quarantine_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE quarantine_records FORCE ROW LEVEL SECURITY;
CREATE POLICY quarantine_records_private_policy ON quarantine_records
  FOR ALL TO PUBLIC
  USING (sj_can_access_institution(institution_id))
  WITH CHECK (sj_can_access_institution(institution_id));

ALTER TABLE reconciliation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE reconciliation_runs FORCE ROW LEVEL SECURITY;
CREATE POLICY reconciliation_runs_private_policy ON reconciliation_runs
  FOR ALL TO PUBLIC
  USING (sj_can_access_institution(institution_id))
  WITH CHECK (sj_can_access_institution(institution_id));

ALTER TABLE public_search_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_search_documents FORCE ROW LEVEL SECURITY;
CREATE POLICY public_search_documents_private_policy ON public_search_documents
  FOR ALL TO PUBLIC
  USING (sj_can_access_institution(institution_id))
  WITH CHECK (sj_can_access_institution(institution_id));
CREATE POLICY public_search_documents_public_policy ON public_search_documents
  FOR SELECT TO PUBLIC
  USING (
    sj_has_database_role('sj_public')
    AND EXISTS (SELECT 1 FROM publications p WHERE p.id = publication_id)
  );

ALTER TABLE central_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE central_jobs FORCE ROW LEVEL SECURITY;
CREATE POLICY central_jobs_worker_policy ON central_jobs
  FOR ALL TO PUBLIC
  USING (
    sj_has_database_role('sj_ops')
    OR sj_has_database_role('sj_worker')
    OR (institution_id IS NOT NULL AND sj_can_access_institution(institution_id))
  )
  WITH CHECK (
    sj_has_database_role('sj_ops')
    OR sj_has_database_role('sj_worker')
    OR (institution_id IS NOT NULL AND sj_can_access_institution(institution_id))
  );

ALTER TABLE taxonomy_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxonomy_versions FORCE ROW LEVEL SECURITY;
CREATE POLICY taxonomy_versions_read_policy ON taxonomy_versions
  FOR SELECT TO PUBLIC
  USING (
    sj_has_database_role('sj_ops')
    OR sj_has_database_role('sj_ingest')
    OR sj_has_database_role('sj_worker')
    OR (sj_has_database_role('sj_public') AND active)
  );
CREATE POLICY taxonomy_versions_ops_policy ON taxonomy_versions
  FOR ALL TO PUBLIC
  USING (sj_has_database_role('sj_ops'))
  WITH CHECK (sj_has_database_role('sj_ops'));

ALTER TABLE taxonomy_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE taxonomy_items FORCE ROW LEVEL SECURITY;
CREATE POLICY taxonomy_items_read_policy ON taxonomy_items
  FOR SELECT TO PUBLIC
  USING (
    sj_has_database_role('sj_ops')
    OR sj_has_database_role('sj_ingest')
    OR sj_has_database_role('sj_worker')
    OR (sj_has_database_role('sj_public') AND active)
  );
CREATE POLICY taxonomy_items_ops_policy ON taxonomy_items
  FOR ALL TO PUBLIC
  USING (sj_has_database_role('sj_ops'))
  WITH CHECK (sj_has_database_role('sj_ops'));

ALTER TABLE ops_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops_users FORCE ROW LEVEL SECURITY;
CREATE POLICY ops_users_policy ON ops_users FOR ALL TO PUBLIC
  USING (sj_has_database_role('sj_ops'))
  WITH CHECK (sj_has_database_role('sj_ops'));

ALTER TABLE ops_mfa_factors ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops_mfa_factors FORCE ROW LEVEL SECURITY;
CREATE POLICY ops_mfa_factors_policy ON ops_mfa_factors FOR ALL TO PUBLIC
  USING (sj_has_database_role('sj_ops'))
  WITH CHECK (sj_has_database_role('sj_ops'));

ALTER TABLE ops_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops_sessions FORCE ROW LEVEL SECURITY;
CREATE POLICY ops_sessions_policy ON ops_sessions FOR ALL TO PUBLIC
  USING (sj_has_database_role('sj_ops'))
  WITH CHECK (sj_has_database_role('sj_ops'));

ALTER TABLE ops_recovery_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops_recovery_codes FORCE ROW LEVEL SECURITY;
CREATE POLICY ops_recovery_codes_policy ON ops_recovery_codes FOR ALL TO PUBLIC
  USING (sj_has_database_role('sj_ops'))
  WITH CHECK (sj_has_database_role('sj_ops'));

ALTER TABLE ops_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops_audit_logs FORCE ROW LEVEL SECURITY;
CREATE POLICY ops_audit_logs_policy ON ops_audit_logs FOR ALL TO PUBLIC
  USING (sj_has_database_role('sj_ops'))
  WITH CHECK (sj_has_database_role('sj_ops'));

-- Exactly one public cover per publication. Partial unique indexes cannot be
-- represented directly by Prisma and therefore live in this additive migration.
CREATE UNIQUE INDEX publication_media_one_cover
  ON publication_media (publication_id)
  WHERE is_cover = true;

-- Database checks backstop application validation for values with security impact.
ALTER TABLE media_objects
  ADD CONSTRAINT media_objects_size_positive CHECK (size_bytes > 0),
  ADD CONSTRAINT media_objects_dimensions_positive CHECK (width > 0 AND height > 0),
  ADD CONSTRAINT media_objects_sha256_format CHECK (sha256 ~ '^[a-f0-9]{64}$');

ALTER TABLE publications
  ADD CONSTRAINT publications_reference_format CHECK (public_reference_code ~ '^SJ-[A-Z0-9]{8}$'),
  ADD CONSTRAINT publications_reconfirmation_after_confirmation CHECK (next_reconfirmation_at > last_confirmed_at);

ALTER TABLE whatsapp_contacts
  ADD CONSTRAINT whatsapp_contacts_e164_format CHECK (phone_e164 ~ '^\+[1-9][0-9]{7,14}$');

ALTER TABLE institution_keys
  ADD CONSTRAINT institution_keys_algorithm_ed25519 CHECK (algorithm = 'ED25519');
