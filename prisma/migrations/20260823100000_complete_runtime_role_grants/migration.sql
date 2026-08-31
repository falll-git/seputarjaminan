-- Complete the explicit runtime privileges required by the central services.
--
-- RLS remains the tenant boundary. These grants only expose the SQL operations
-- that each dedicated connection role performs in the application source.
-- No runtime role receives table ownership, schema CREATE, TRUNCATE, REFERENCES,
-- TRIGGER, or blanket privileges.

GRANT USAGE ON SCHEMA public TO
  sj_registry,
  sj_ingest,
  sj_public,
  sj_worker,
  sj_ops;

-- Signed-request registry: resolve an asserted institution, installation, and
-- active verification key. This connection is intentionally read-only.
GRANT SELECT ON
  institutions,
  institution_installations,
  institution_keys
TO sj_registry;

-- Ruwang ingestion and media-upload API. Institution context is set inside the
-- transaction before any tenant row is accessed.
GRANT SELECT ON
  institutions,
  institution_keys
TO sj_ingest;
-- Prisma uses INSERT ... RETURNING for create operations, so the inserted row
-- also needs SELECT. RLS still limits the returned nonce to the current tenant.
GRANT SELECT, INSERT ON request_nonces TO sj_ingest;

GRANT SELECT, INSERT, UPDATE ON
  institution_installations,
  bprs_profiles,
  whatsapp_contacts,
  publications,
  media_objects,
  media_upload_sessions,
  ingest_events,
  aggregate_cursors,
  reconciliation_runs,
  central_jobs
TO sj_ingest;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  land_details,
  building_details,
  machine_details,
  vehicle_details,
  publication_media
TO sj_ingest;

GRANT SELECT, UPDATE ON quarantine_records TO sj_ingest;

-- Anonymous website/API reader. Every object is still filtered by its public
-- RLS policy, including state, availability, and 30-day reconfirmation checks.
GRANT SELECT ON
  institutions,
  bprs_profiles,
  whatsapp_contacts,
  publications,
  land_details,
  building_details,
  machine_details,
  vehicle_details,
  media_objects,
  publication_media,
  public_search_documents
TO sj_public;

-- Background worker: claim jobs, process media, rebuild disposable public
-- projections, reconcile manifests, and remove expired transient records.
GRANT SELECT, UPDATE ON
  central_jobs,
  media_objects,
  publications,
  reconciliation_runs
TO sj_worker;

GRANT SELECT ON
  publication_media,
  aggregate_cursors
TO sj_worker;

GRANT SELECT, INSERT, UPDATE, DELETE ON public_search_documents TO sj_worker;
GRANT SELECT, DELETE ON request_nonces TO sj_worker;
GRANT SELECT, DELETE ON media_upload_sessions TO sj_worker;

-- Private central operations plane. This role is never used by the public site
-- or by a BPRS installation.
GRANT SELECT, INSERT, UPDATE ON
  institutions,
  institution_installations,
  institution_keys
TO sj_ops;

GRANT SELECT, UPDATE ON
  bprs_profiles,
  publications,
  media_objects
TO sj_ops;

GRANT SELECT, INSERT, UPDATE ON quarantine_records TO sj_ops;
GRANT SELECT ON central_jobs TO sj_ops;

GRANT SELECT, INSERT, UPDATE ON
  ops_users,
  ops_sessions,
  ops_auth_challenges,
  ops_recovery_codes
TO sj_ops;

GRANT SELECT ON ops_mfa_factors TO sj_ops;
GRANT SELECT, INSERT ON ops_audit_logs TO sj_ops;
