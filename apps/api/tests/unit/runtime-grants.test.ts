import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../../../../prisma/migrations/20260823100000_complete_runtime_role_grants/migration.sql",
  import.meta.url,
);
const provisioningUrl = new URL(
  "../../../../infra/postgres/grant-runtime-access.sql",
  import.meta.url,
);
const workerNonceLookupMigrationUrl = new URL(
  "../../../../prisma/migrations/20260823110000_allow_worker_nonce_policy_lookup/migration.sql",
  import.meta.url,
);

test("migration runtime memakai grant eksplisit dan mempertahankan public read-only", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  assert.doesNotMatch(sql, /GRANT\s+ALL\b/iu);
  assert.doesNotMatch(sql, /GRANT\s+CREATE\b/iu);
  assert.doesNotMatch(sql, /GRANT\s+(?:TRUNCATE|REFERENCES|TRIGGER)\b/iu);
  assert.doesNotMatch(sql, /ON\s+ALL\s+TABLES/iu);

  const executableSql = sql.replace(/--.*$/gmu, "");
  const publicTableGrants = executableSql
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => /^GRANT\b/iu.test(statement) && /\bTO\s+sj_public$/iu.test(statement));
  assert.equal(publicTableGrants.length, 1);
  assert.match(publicTableGrants[0], /^GRANT\s+SELECT\s+ON\b/iu);
  assert.doesNotMatch(publicTableGrants[0], /\b(?:INSERT|UPDATE|DELETE)\b/iu);

  assert.match(sql, /GRANT\s+SELECT,\s*INSERT\s+ON\s+request_nonces\s+TO\s+sj_ingest/iu);
  assert.match(sql, /GRANT\s+SELECT,\s*INSERT\s+ON\s+ops_audit_logs\s+TO\s+sj_ops/iu);
});

test("skrip provisioning tidak dapat memperluas izin tabel dari migration", async () => {
  const sql = await readFile(provisioningUrl, "utf8");
  const executableSql = sql.replace(/--.*$/gmu, "");

  assert.match(executableSql, /GRANT\s+CONNECT\s+ON\s+DATABASE/iu);
  assert.doesNotMatch(executableSql, /\bON\s+(?:ALL\s+)?TABLES?\b/iu);
  assert.doesNotMatch(executableSql, /\bON\s+(?:ALL\s+)?SEQUENCES?\b/iu);
  assert.doesNotMatch(executableSql, /ALTER\s+DEFAULT\s+PRIVILEGES/iu);
});

test("worker hanya dapat membaca kolom kunci yang diperlukan kebijakan RLS nonce", async () => {
  const sql = await readFile(workerNonceLookupMigrationUrl, "utf8");
  const executableSql = sql.replace(/--.*$/gmu, "");

  assert.match(
    executableSql,
    /GRANT\s+SELECT\s*\(\s*key_id\s*,\s*institution_id\s*\)\s+ON\s+institution_keys\s+TO\s+sj_worker/iu,
  );
  assert.doesNotMatch(executableSql, /GRANT\s+SELECT\s+ON\s+institution_keys/iu);
  assert.doesNotMatch(executableSql, /\b(?:INSERT|UPDATE|DELETE|TRUNCATE|REFERENCES|TRIGGER)\b/iu);
});
