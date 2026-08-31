-- CreateEnum
CREATE TYPE "institution_state" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "installation_state" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'REVOKED');

-- CreateEnum
CREATE TYPE "key_state" AS ENUM ('ACTIVE', 'ROTATING', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "public_profile_state" AS ENUM ('ACTIVE', 'QUARANTINED', 'HIDDEN');

-- CreateEnum
CREATE TYPE "central_contact_state" AS ENUM ('VERIFIED', 'REVOKED');

-- CreateEnum
CREATE TYPE "central_publication_state" AS ENUM ('PUBLISHED', 'UNPUBLISHED', 'ARCHIVED', 'QUARANTINED');

-- CreateEnum
CREATE TYPE "public_availability" AS ENUM ('AVAILABLE', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "asset_category" AS ENUM ('TANAH', 'BANGUNAN', 'MESIN_PERALATAN', 'KENDARAAN');

-- CreateEnum
CREATE TYPE "media_state" AS ENUM ('AWAITING_UPLOAD', 'UPLOADED', 'PROCESSING', 'READY', 'REJECTED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "storage_backend" AS ENUM ('FILESYSTEM', 'S3_COMPATIBLE');

-- CreateEnum
CREATE TYPE "ingest_state" AS ENUM ('RECEIVED', 'APPLIED', 'DUPLICATE', 'REJECTED');

-- CreateEnum
CREATE TYPE "quarantine_state" AS ENUM ('ACTIVE', 'RESOLVED');

-- CreateEnum
CREATE TYPE "reconciliation_state" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "central_job_state" AS ENUM ('PENDING', 'PROCESSING', 'RETRY_WAIT', 'COMPLETED', 'DEAD_LETTER');

-- CreateEnum
CREATE TYPE "ops_user_state" AS ENUM ('INVITED', 'ACTIVE', 'LOCKED', 'REVOKED');

-- CreateTable
CREATE TABLE "institutions" (
    "id" UUID NOT NULL,
    "legal_name_internal" TEXT NOT NULL,
    "public_slug" TEXT NOT NULL,
    "state" "institution_state" NOT NULL DEFAULT 'ACTIVE',
    "onboarded_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "suspended_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "institutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "institution_installations" (
    "id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "installation_name" TEXT NOT NULL,
    "source_domain_metadata" JSONB,
    "state" "installation_state" NOT NULL DEFAULT 'PENDING',
    "contract_version" INTEGER NOT NULL DEFAULT 1,
    "last_seen_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "institution_installations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "institution_keys" (
    "key_id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "installation_id" UUID NOT NULL,
    "public_key" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL DEFAULT 'ED25519',
    "state" "key_state" NOT NULL DEFAULT 'ACTIVE',
    "valid_from" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_until" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "institution_keys_pkey" PRIMARY KEY ("key_id")
);

-- CreateTable
CREATE TABLE "request_nonces" (
    "id" UUID NOT NULL,
    "key_id" UUID NOT NULL,
    "nonce_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_nonces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bprs_profiles" (
    "id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "source_profile_id" UUID NOT NULL,
    "source_version" INTEGER NOT NULL,
    "public_name" TEXT NOT NULL,
    "public_mark_media_id" UUID NOT NULL,
    "short_description" TEXT NOT NULL,
    "office_city_regency" TEXT NOT NULL,
    "office_province" TEXT NOT NULL,
    "profile_updated_at" TIMESTAMPTZ(3) NOT NULL,
    "payload_checksum" CHAR(64) NOT NULL,
    "state" "public_profile_state" NOT NULL DEFAULT 'ACTIVE',
    "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "bprs_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_contacts" (
    "id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "source_contact_id" UUID NOT NULL,
    "source_version" INTEGER NOT NULL,
    "phone_e164" TEXT NOT NULL,
    "message_template_version" INTEGER NOT NULL,
    "state" "central_contact_state" NOT NULL DEFAULT 'VERIFIED',
    "verified_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "payload_checksum" CHAR(64) NOT NULL,
    "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "whatsapp_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publications" (
    "id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "source_publication_id" UUID NOT NULL,
    "public_reference_code" TEXT NOT NULL,
    "aggregate_version" INTEGER NOT NULL,
    "profile_id" UUID NOT NULL,
    "whatsapp_contact_id" UUID NOT NULL,
    "taxonomy_version" INTEGER NOT NULL,
    "subcategory_code" TEXT NOT NULL,
    "category" "asset_category" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "city_regency" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "availability" "public_availability" NOT NULL DEFAULT 'AVAILABLE',
    "state" "central_publication_state" NOT NULL DEFAULT 'PUBLISHED',
    "published_at" TIMESTAMPTZ(3) NOT NULL,
    "public_updated_at" TIMESTAMPTZ(3) NOT NULL,
    "last_confirmed_at" TIMESTAMPTZ(3) NOT NULL,
    "next_reconfirmation_at" TIMESTAMPTZ(3) NOT NULL,
    "payload_checksum" CHAR(64) NOT NULL,
    "unpublished_at" TIMESTAMPTZ(3),
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "publications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "land_details" (
    "publication_id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "land_area_m2" DECIMAL(14,2) NOT NULL,
    "contour" TEXT,
    "road_access" TEXT,

    CONSTRAINT "land_details_pkey" PRIMARY KEY ("publication_id")
);

-- CreateTable
CREATE TABLE "building_details" (
    "publication_id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "land_area_m2" DECIMAL(14,2),
    "building_area_m2" DECIMAL(14,2) NOT NULL,
    "floor_count" INTEGER,
    "public_usage" TEXT,

    CONSTRAINT "building_details_pkey" PRIMARY KEY ("publication_id")
);

-- CreateTable
CREATE TABLE "machine_details" (
    "publication_id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "brand_or_manufacturer" TEXT,
    "model_or_type" TEXT NOT NULL,
    "manufacture_year" INTEGER,
    "public_capacity" TEXT,
    "public_condition" TEXT NOT NULL,

    CONSTRAINT "machine_details_pkey" PRIMARY KEY ("publication_id")
);

-- CreateTable
CREATE TABLE "vehicle_details" (
    "publication_id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "brand" TEXT NOT NULL,
    "model_or_type" TEXT NOT NULL,
    "manufacture_year" INTEGER,
    "transmission" TEXT,
    "fuel_type" TEXT,
    "mileage_km" DECIMAL(14,2),
    "public_condition" TEXT NOT NULL,

    CONSTRAINT "vehicle_details_pkey" PRIMARY KEY ("publication_id")
);

-- CreateTable
CREATE TABLE "media_objects" (
    "id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "source_media_id" UUID NOT NULL,
    "source_publication_id" UUID NOT NULL,
    "logical_object_key" TEXT NOT NULL,
    "storage_backend" "storage_backend" NOT NULL,
    "state" "media_state" NOT NULL DEFAULT 'AWAITING_UPLOAD',
    "sha256" CHAR(64) NOT NULL,
    "detected_mime" TEXT NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "scan_result" TEXT,
    "derivative_metadata" JSONB,
    "ready_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "deletion_eligible_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "media_objects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publication_media" (
    "institution_id" UUID NOT NULL,
    "publication_id" UUID NOT NULL,
    "media_object_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "is_cover" BOOLEAN NOT NULL DEFAULT false,
    "alt_text" TEXT NOT NULL,

    CONSTRAINT "publication_media_pkey" PRIMARY KEY ("publication_id","media_object_id")
);

-- CreateTable
CREATE TABLE "media_upload_sessions" (
    "id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "media_object_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "expected_sha256" CHAR(64) NOT NULL,
    "expected_mime" TEXT NOT NULL,
    "max_bytes" BIGINT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "consumed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_upload_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingest_events" (
    "event_id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "installation_id" UUID NOT NULL,
    "key_id" UUID NOT NULL,
    "aggregate_type" TEXT NOT NULL,
    "aggregate_id" UUID NOT NULL,
    "aggregate_version" INTEGER NOT NULL,
    "event_type" TEXT NOT NULL,
    "schema_version" INTEGER NOT NULL,
    "payload_checksum" CHAR(64) NOT NULL,
    "payload" JSONB NOT NULL,
    "request_timestamp" TIMESTAMPTZ(3) NOT NULL,
    "nonce_hash" CHAR(64) NOT NULL,
    "state" "ingest_state" NOT NULL DEFAULT 'RECEIVED',
    "error_code" TEXT,
    "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ(3),

    CONSTRAINT "ingest_events_pkey" PRIMARY KEY ("event_id")
);

-- CreateTable
CREATE TABLE "quarantine_records" (
    "id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "subject_type" TEXT NOT NULL,
    "subject_id" UUID NOT NULL,
    "reason_code" TEXT NOT NULL,
    "safe_detail" TEXT,
    "state" "quarantine_state" NOT NULL DEFAULT 'ACTIVE',
    "created_by_ops_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ(3),

    CONSTRAINT "quarantine_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reconciliation_runs" (
    "id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "installation_id" UUID NOT NULL,
    "state" "reconciliation_state" NOT NULL DEFAULT 'PENDING',
    "manifest_checksum" CHAR(64) NOT NULL,
    "manifest" JSONB NOT NULL,
    "count_checked" INTEGER NOT NULL DEFAULT 0,
    "count_mismatch" INTEGER NOT NULL DEFAULT 0,
    "safe_mismatch_report" JSONB,
    "started_at" TIMESTAMPTZ(3),
    "finished_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reconciliation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public_search_documents" (
    "publication_id" UUID NOT NULL,
    "institution_id" UUID NOT NULL,
    "normalized_text" TEXT NOT NULL,
    "filter_document" JSONB NOT NULL,
    "cover_media_id" UUID NOT NULL,
    "projection_version" INTEGER NOT NULL,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "public_search_documents_pkey" PRIMARY KEY ("publication_id")
);

-- CreateTable
CREATE TABLE "central_jobs" (
    "id" UUID NOT NULL,
    "institution_id" UUID,
    "job_type" TEXT NOT NULL,
    "dedupe_key" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "state" "central_job_state" NOT NULL DEFAULT 'PENDING',
    "available_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lease_until" TIMESTAMPTZ(3),
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "last_error_code" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "central_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "taxonomy_versions" (
    "version" INTEGER NOT NULL,
    "checksum" CHAR(64) NOT NULL,
    "signature" TEXT NOT NULL,
    "valid_from" TIMESTAMPTZ(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "taxonomy_versions_pkey" PRIMARY KEY ("version")
);

-- CreateTable
CREATE TABLE "taxonomy_items" (
    "id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "parent_code" TEXT,
    "label_id" TEXT NOT NULL,
    "required_schema" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "taxonomy_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ops_users" (
    "id" UUID NOT NULL,
    "email_normalized" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "state" "ops_user_state" NOT NULL DEFAULT 'INVITED',
    "failed_attempt_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ops_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ops_mfa_factors" (
    "id" UUID NOT NULL,
    "ops_user_id" UUID NOT NULL,
    "encrypted_secret" TEXT NOT NULL,
    "verified_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ops_mfa_factors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ops_sessions" (
    "id" UUID NOT NULL,
    "ops_user_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "csrf_token_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ops_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ops_recovery_codes" (
    "id" UUID NOT NULL,
    "ops_user_id" UUID NOT NULL,
    "code_hash" TEXT NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ops_recovery_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ops_audit_logs" (
    "id" UUID NOT NULL,
    "ops_user_id" UUID,
    "action" TEXT NOT NULL,
    "subject_type" TEXT NOT NULL,
    "subject_id" UUID,
    "request_id" UUID NOT NULL,
    "safe_metadata" JSONB,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ops_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "institutions_public_slug_key" ON "institutions"("public_slug");

-- CreateIndex
CREATE INDEX "institution_installations_state_last_seen_at_idx" ON "institution_installations"("state", "last_seen_at");

-- CreateIndex
CREATE UNIQUE INDEX "institution_installations_institution_id_id_key" ON "institution_installations"("institution_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "institution_installations_institution_id_installation_name_key" ON "institution_installations"("institution_id", "installation_name");

-- CreateIndex
CREATE INDEX "institution_keys_installation_id_state_idx" ON "institution_keys"("installation_id", "state");

-- CreateIndex
CREATE UNIQUE INDEX "institution_keys_institution_id_key_id_key" ON "institution_keys"("institution_id", "key_id");

-- CreateIndex
CREATE INDEX "request_nonces_expires_at_idx" ON "request_nonces"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "request_nonces_key_id_nonce_hash_key" ON "request_nonces"("key_id", "nonce_hash");

-- CreateIndex
CREATE UNIQUE INDEX "bprs_profiles_institution_id_key" ON "bprs_profiles"("institution_id");

-- CreateIndex
CREATE INDEX "bprs_profiles_state_updated_at_idx" ON "bprs_profiles"("state", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "bprs_profiles_institution_id_id_key" ON "bprs_profiles"("institution_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "bprs_profiles_institution_id_source_profile_id_key" ON "bprs_profiles"("institution_id", "source_profile_id");

-- CreateIndex
CREATE INDEX "whatsapp_contacts_institution_id_state_idx" ON "whatsapp_contacts"("institution_id", "state");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_contacts_institution_id_id_key" ON "whatsapp_contacts"("institution_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_contacts_institution_id_source_contact_id_key" ON "whatsapp_contacts"("institution_id", "source_contact_id");

-- CreateIndex
CREATE UNIQUE INDEX "publications_public_reference_code_key" ON "publications"("public_reference_code");

-- CreateIndex
CREATE INDEX "publications_state_public_updated_at_id_idx" ON "publications"("state", "public_updated_at" DESC, "id");

-- CreateIndex
CREATE INDEX "publications_province_city_regency_category_state_idx" ON "publications"("province", "city_regency", "category", "state");

-- CreateIndex
CREATE INDEX "publications_institution_id_state_idx" ON "publications"("institution_id", "state");

-- CreateIndex
CREATE INDEX "publications_next_reconfirmation_at_state_idx" ON "publications"("next_reconfirmation_at", "state");

-- CreateIndex
CREATE UNIQUE INDEX "publications_institution_id_id_key" ON "publications"("institution_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "publications_institution_id_source_publication_id_key" ON "publications"("institution_id", "source_publication_id");

-- CreateIndex
CREATE INDEX "land_details_institution_id_idx" ON "land_details"("institution_id");

-- CreateIndex
CREATE UNIQUE INDEX "land_details_institution_id_publication_id_key" ON "land_details"("institution_id", "publication_id");

-- CreateIndex
CREATE INDEX "building_details_institution_id_idx" ON "building_details"("institution_id");

-- CreateIndex
CREATE UNIQUE INDEX "building_details_institution_id_publication_id_key" ON "building_details"("institution_id", "publication_id");

-- CreateIndex
CREATE INDEX "machine_details_institution_id_idx" ON "machine_details"("institution_id");

-- CreateIndex
CREATE UNIQUE INDEX "machine_details_institution_id_publication_id_key" ON "machine_details"("institution_id", "publication_id");

-- CreateIndex
CREATE INDEX "vehicle_details_institution_id_idx" ON "vehicle_details"("institution_id");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_details_institution_id_publication_id_key" ON "vehicle_details"("institution_id", "publication_id");

-- CreateIndex
CREATE INDEX "media_objects_institution_id_state_idx" ON "media_objects"("institution_id", "state");

-- CreateIndex
CREATE INDEX "media_objects_state_created_at_idx" ON "media_objects"("state", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "media_objects_institution_id_id_key" ON "media_objects"("institution_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "media_objects_institution_id_source_media_id_key" ON "media_objects"("institution_id", "source_media_id");

-- CreateIndex
CREATE INDEX "publication_media_institution_id_media_object_id_idx" ON "publication_media"("institution_id", "media_object_id");

-- CreateIndex
CREATE UNIQUE INDEX "publication_media_publication_id_sort_order_key" ON "publication_media"("publication_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "media_upload_sessions_token_hash_key" ON "media_upload_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "media_upload_sessions_institution_id_expires_at_idx" ON "media_upload_sessions"("institution_id", "expires_at");

-- CreateIndex
CREATE INDEX "ingest_events_institution_id_aggregate_id_aggregate_version_idx" ON "ingest_events"("institution_id", "aggregate_id", "aggregate_version");

-- CreateIndex
CREATE INDEX "ingest_events_state_received_at_idx" ON "ingest_events"("state", "received_at");

-- CreateIndex
CREATE UNIQUE INDEX "ingest_events_institution_id_aggregate_id_aggregate_version_key" ON "ingest_events"("institution_id", "aggregate_id", "aggregate_version", "event_type");

-- CreateIndex
CREATE INDEX "quarantine_records_institution_id_subject_type_subject_id_s_idx" ON "quarantine_records"("institution_id", "subject_type", "subject_id", "state");

-- CreateIndex
CREATE INDEX "reconciliation_runs_institution_id_state_created_at_idx" ON "reconciliation_runs"("institution_id", "state", "created_at");

-- CreateIndex
CREATE INDEX "public_search_documents_institution_id_updated_at_idx" ON "public_search_documents"("institution_id", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "public_search_documents_institution_id_publication_id_key" ON "public_search_documents"("institution_id", "publication_id");

-- CreateIndex
CREATE UNIQUE INDEX "central_jobs_dedupe_key_key" ON "central_jobs"("dedupe_key");

-- CreateIndex
CREATE INDEX "central_jobs_state_available_at_idx" ON "central_jobs"("state", "available_at");

-- CreateIndex
CREATE INDEX "taxonomy_items_version_parent_code_active_idx" ON "taxonomy_items"("version", "parent_code", "active");

-- CreateIndex
CREATE UNIQUE INDEX "taxonomy_items_version_code_key" ON "taxonomy_items"("version", "code");

-- CreateIndex
CREATE UNIQUE INDEX "ops_users_email_normalized_key" ON "ops_users"("email_normalized");

-- CreateIndex
CREATE INDEX "ops_mfa_factors_ops_user_id_revoked_at_idx" ON "ops_mfa_factors"("ops_user_id", "revoked_at");

-- CreateIndex
CREATE UNIQUE INDEX "ops_sessions_token_hash_key" ON "ops_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "ops_sessions_ops_user_id_expires_at_idx" ON "ops_sessions"("ops_user_id", "expires_at");

-- CreateIndex
CREATE INDEX "ops_recovery_codes_ops_user_id_used_at_idx" ON "ops_recovery_codes"("ops_user_id", "used_at");

-- CreateIndex
CREATE INDEX "ops_audit_logs_occurred_at_idx" ON "ops_audit_logs"("occurred_at" DESC);

-- CreateIndex
CREATE INDEX "ops_audit_logs_ops_user_id_occurred_at_idx" ON "ops_audit_logs"("ops_user_id", "occurred_at" DESC);

-- AddForeignKey
ALTER TABLE "institution_installations" ADD CONSTRAINT "institution_installations_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "institution_keys" ADD CONSTRAINT "institution_keys_institution_id_installation_id_fkey" FOREIGN KEY ("institution_id", "installation_id") REFERENCES "institution_installations"("institution_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_nonces" ADD CONSTRAINT "request_nonces_key_id_fkey" FOREIGN KEY ("key_id") REFERENCES "institution_keys"("key_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bprs_profiles" ADD CONSTRAINT "bprs_profiles_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bprs_profiles" ADD CONSTRAINT "bprs_profiles_institution_id_public_mark_media_id_fkey" FOREIGN KEY ("institution_id", "public_mark_media_id") REFERENCES "media_objects"("institution_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_contacts" ADD CONSTRAINT "whatsapp_contacts_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publications" ADD CONSTRAINT "publications_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publications" ADD CONSTRAINT "publications_institution_id_profile_id_fkey" FOREIGN KEY ("institution_id", "profile_id") REFERENCES "bprs_profiles"("institution_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publications" ADD CONSTRAINT "publications_institution_id_whatsapp_contact_id_fkey" FOREIGN KEY ("institution_id", "whatsapp_contact_id") REFERENCES "whatsapp_contacts"("institution_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "land_details" ADD CONSTRAINT "land_details_institution_id_publication_id_fkey" FOREIGN KEY ("institution_id", "publication_id") REFERENCES "publications"("institution_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "building_details" ADD CONSTRAINT "building_details_institution_id_publication_id_fkey" FOREIGN KEY ("institution_id", "publication_id") REFERENCES "publications"("institution_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machine_details" ADD CONSTRAINT "machine_details_institution_id_publication_id_fkey" FOREIGN KEY ("institution_id", "publication_id") REFERENCES "publications"("institution_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_details" ADD CONSTRAINT "vehicle_details_institution_id_publication_id_fkey" FOREIGN KEY ("institution_id", "publication_id") REFERENCES "publications"("institution_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_objects" ADD CONSTRAINT "media_objects_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publication_media" ADD CONSTRAINT "publication_media_institution_id_publication_id_fkey" FOREIGN KEY ("institution_id", "publication_id") REFERENCES "publications"("institution_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publication_media" ADD CONSTRAINT "publication_media_institution_id_media_object_id_fkey" FOREIGN KEY ("institution_id", "media_object_id") REFERENCES "media_objects"("institution_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_upload_sessions" ADD CONSTRAINT "media_upload_sessions_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_upload_sessions" ADD CONSTRAINT "media_upload_sessions_institution_id_media_object_id_fkey" FOREIGN KEY ("institution_id", "media_object_id") REFERENCES "media_objects"("institution_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingest_events" ADD CONSTRAINT "ingest_events_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingest_events" ADD CONSTRAINT "ingest_events_institution_id_installation_id_fkey" FOREIGN KEY ("institution_id", "installation_id") REFERENCES "institution_installations"("institution_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingest_events" ADD CONSTRAINT "ingest_events_institution_id_key_id_fkey" FOREIGN KEY ("institution_id", "key_id") REFERENCES "institution_keys"("institution_id", "key_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quarantine_records" ADD CONSTRAINT "quarantine_records_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quarantine_records" ADD CONSTRAINT "quarantine_records_created_by_ops_user_id_fkey" FOREIGN KEY ("created_by_ops_user_id") REFERENCES "ops_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliation_runs" ADD CONSTRAINT "reconciliation_runs_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliation_runs" ADD CONSTRAINT "reconciliation_runs_institution_id_installation_id_fkey" FOREIGN KEY ("institution_id", "installation_id") REFERENCES "institution_installations"("institution_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_search_documents" ADD CONSTRAINT "public_search_documents_institution_id_publication_id_fkey" FOREIGN KEY ("institution_id", "publication_id") REFERENCES "publications"("institution_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "central_jobs" ADD CONSTRAINT "central_jobs_institution_id_fkey" FOREIGN KEY ("institution_id") REFERENCES "institutions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "taxonomy_items" ADD CONSTRAINT "taxonomy_items_version_fkey" FOREIGN KEY ("version") REFERENCES "taxonomy_versions"("version") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ops_mfa_factors" ADD CONSTRAINT "ops_mfa_factors_ops_user_id_fkey" FOREIGN KEY ("ops_user_id") REFERENCES "ops_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ops_sessions" ADD CONSTRAINT "ops_sessions_ops_user_id_fkey" FOREIGN KEY ("ops_user_id") REFERENCES "ops_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ops_recovery_codes" ADD CONSTRAINT "ops_recovery_codes_ops_user_id_fkey" FOREIGN KEY ("ops_user_id") REFERENCES "ops_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ops_audit_logs" ADD CONSTRAINT "ops_audit_logs_ops_user_id_fkey" FOREIGN KEY ("ops_user_id") REFERENCES "ops_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
