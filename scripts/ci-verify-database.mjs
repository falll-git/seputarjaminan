import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Client } = pg;
const ownerUrl = required("SJ_TEST_OWNER_DATABASE_URL");
const migrationDirectory = fileURLToPath(new URL("../prisma/migrations/", import.meta.url));
const expectedMigrations = (await readdir(migrationDirectory, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
const expectedMigrationChecksums = new Map(
  await Promise.all(
    expectedMigrations.map(async (migrationName) => {
      const sql = await readFile(new URL(`../prisma/migrations/${migrationName}/migration.sql`, import.meta.url));
      return [migrationName, createHash("sha256").update(sql).digest("hex")];
    }),
  ),
);

assert.equal(expectedMigrations.length, 19, "Quality gate wajib menguji baseline V1 sampai provenance dan receipt recovery Control.");

const runtimeRoles = [
  ["SJ_TEST_REGISTRY_DATABASE_URL", "sj_registry"],
  ["SJ_TEST_INGEST_DATABASE_URL", "sj_ingest"],
  ["SJ_TEST_PUBLIC_DATABASE_URL", "sj_public"],
  ["SJ_TEST_OPS_DATABASE_URL", "sj_ops"],
  ["SJ_TEST_WORKER_DATABASE_URL", "sj_worker"],
];

const requiredIndexes = [
  "aggregate_cursors_institution_id_aggregate_id_key",
  "aggregate_cursors_institution_id_aggregate_type_expected_st_idx",
  "ops_auth_challenges_token_hash_key",
  "publication_media_one_cover",
  "quarantine_records_one_active_subject_idx",
].sort();

const requiredCheckConstraints = [
  "aggregate_cursors_checksum_format",
  "aggregate_cursors_version_positive",
  "institution_keys_algorithm_ed25519",
  "ingest_event_identity_checksum_valid",
  "media_delivery_complete",
  "media_delivery_all_or_none",
  "media_objects_dimensions_positive",
  "media_objects_sha256_format",
  "media_objects_size_positive",
  "media_ready_has_delivery",
  "publications_reconfirmation_after_confirmation",
  "publications_reference_format",
  "whatsapp_contacts_e164_format",
].sort();

const requiredForcedRlsTables = [
  "aggregate_cursors",
  "bprs_profiles",
  "building_details",
  "central_jobs",
  "control_recovery_receipts",
  "ingest_events",
  "institution_installations",
  "institution_keys",
  "institutions",
  "land_details",
  "machine_details",
  "media_objects",
  "media_upload_sessions",
  "ops_audit_logs",
  "ops_auth_challenges",
  "ops_mfa_factors",
  "ops_recovery_codes",
  "ops_sessions",
  "ops_users",
  "public_search_documents",
  "publication_media",
  "publications",
  "quarantine_records",
  "reconciliation_runs",
  "request_nonces",
  "taxonomy_items",
  "taxonomy_versions",
  "vehicle_details",
  "whatsapp_contacts",
].sort();

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} wajib tersedia.`);
  return value;
}

const owner = new Client({ connectionString: ownerUrl });
await owner.connect();

try {
  const migrationRows = await owner.query(
    `SELECT migration_name, checksum, finished_at, rolled_back_at, logs
       FROM _prisma_migrations
      ORDER BY migration_name`,
  );
  assert.deepEqual(migrationRows.rows.map((row) => row.migration_name), expectedMigrations);
  assert.ok(
    migrationRows.rows.every((row) => row.finished_at && !row.rolled_back_at && !row.logs),
    "Seluruh migration harus selesai tanpa rollback atau log kegagalan.",
  );
  for (const row of migrationRows.rows) {
    assert.equal(
      row.checksum,
      expectedMigrationChecksums.get(row.migration_name),
      `${row.migration_name} tidak cocok dengan checksum source.`,
    );
  }

  const indexes = await owner.query(
    `SELECT indexname
       FROM pg_indexes
      WHERE schemaname = 'public' AND indexname = ANY($1::text[])
      ORDER BY indexname`,
    [requiredIndexes],
  );
  assert.deepEqual(indexes.rows.map((row) => row.indexname), requiredIndexes);

  const constraints = await owner.query(
    `SELECT con.conname
       FROM pg_constraint con
       JOIN pg_class table_class ON table_class.oid = con.conrelid
       JOIN pg_namespace namespace ON namespace.oid = table_class.relnamespace
      WHERE namespace.nspname = 'public'
        AND con.contype = 'c'
        AND con.conname = ANY($1::text[])
      ORDER BY con.conname`,
    [requiredCheckConstraints],
  );
  assert.deepEqual(constraints.rows.map((row) => row.conname), requiredCheckConstraints);

  const forcedRlsTables = await owner.query(`
    SELECT table_class.relname AS table_name
      FROM pg_class table_class
      JOIN pg_namespace namespace ON namespace.oid = table_class.relnamespace
     WHERE namespace.nspname = 'public'
       AND table_class.relkind IN ('r', 'p')
       AND table_class.relrowsecurity
       AND table_class.relforcerowsecurity
     ORDER BY table_class.relname
  `);
  assert.deepEqual(forcedRlsTables.rows.map((row) => row.table_name), requiredForcedRlsTables);

  const lease = await owner.query("SELECT data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='central_jobs' AND column_name='lease_token'");
  assert.equal(lease.rows[0]?.data_type, "uuid");
  const retryGrants = await owner.query("SELECT has_column_privilege('sj_ops','central_jobs','state','UPDATE') AS retry_state, has_column_privilege('sj_ops','central_jobs','payload','UPDATE') AS payload_write");
  assert.deepEqual(retryGrants.rows[0], { retry_state: true, payload_write: false });
  const identity = await owner.query("SELECT data_type,character_maximum_length,is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='ingest_events' AND column_name='identity_checksum'");
  assert.deepEqual(identity.rows[0], { data_type: 'character', character_maximum_length: 64, is_nullable: 'YES' });
  for (const table of ['institutions', 'bprs_profiles', 'whatsapp_contacts']) {
    const grants = await owner.query("SELECT has_table_privilege('sj_worker',$1,'SELECT') AS read, has_table_privilege('sj_worker',$1,'UPDATE') AS write", [table]);
    assert.deepEqual(grants.rows[0], { read: true, write: false });
  }

  for (const table of ['media_objects', 'central_jobs']) {
    const origin = await owner.query("SELECT data_type,is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name='origin_installation_id'", [table]);
    assert.deepEqual(origin.rows[0], { data_type: 'uuid', is_nullable: 'YES' });
  }
  const originTriggers = await owner.query("SELECT tgname FROM pg_trigger WHERE NOT tgisinternal AND tgname IN ('media_origin_immutable','job_origin_immutable') ORDER BY tgname");
  assert.deepEqual(originTriggers.rows.map(row => row.tgname), ['job_origin_immutable', 'media_origin_immutable']);
  const receiptGrants = await owner.query("SELECT has_table_privilege('sj_ingest','control_recovery_receipts','SELECT') AS read, has_table_privilege('sj_ingest','control_recovery_receipts','INSERT') AS insert, has_table_privilege('sj_ingest','control_recovery_receipts','UPDATE') AS update, has_table_privilege('sj_ingest','control_recovery_receipts','DELETE') AS delete");
  assert.deepEqual(receiptGrants.rows[0], { read: true, insert: true, update: false, delete: false });

  for (const [urlVariable, membershipRole] of runtimeRoles) {
    const connectionUrl = new URL(required(urlVariable));
    const loginRole = decodeURIComponent(connectionUrl.username);
    assert.match(loginRole, /^sj_ci_[a-z]+$/u);
    const role = await owner.query(
      `SELECT rolcanlogin, rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls,
              pg_has_role($1, $2, 'member') AS is_member
         FROM pg_roles
        WHERE rolname = $1`,
      [loginRole, membershipRole],
    );
    assert.equal(role.rowCount, 1, `${loginRole} tidak ditemukan.`);
    assert.deepEqual(role.rows[0], {
      rolcanlogin: true,
      rolsuper: false,
      rolcreatedb: false,
      rolcreaterole: false,
      rolreplication: false,
      rolbypassrls: false,
      is_member: true,
    });
  }

  console.log(
    "Database terverifikasi: 19 migration beserta checksum, constraint, index, FORCE RLS, provenance, receipt recovery dan lima role runtime least-privilege valid.",
  );
} finally {
  await owner.end();
}
