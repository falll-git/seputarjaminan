import assert from "node:assert/strict";
import test from "node:test";
import pg from "pg";

const { Client } = pg;
const ownerUrl = process.env.SJ_TEST_OWNER_DATABASE_URL;
const registryUrl = process.env.SJ_TEST_REGISTRY_DATABASE_URL;
const ingestUrl = process.env.SJ_TEST_INGEST_DATABASE_URL;
const publicUrl = process.env.SJ_TEST_PUBLIC_DATABASE_URL;
const opsUrl = process.env.SJ_TEST_OPS_DATABASE_URL;

const institutionA = "a1000000-0000-4000-8000-000000000001";
const institutionB = "b1000000-0000-4000-8000-000000000002";

function loginRole(connectionString: string | undefined) {
  assert.ok(connectionString, "Connection URL runtime wajib tersedia.");
  const role = decodeURIComponent(new URL(connectionString).username);
  assert.match(role, /^[a-z][a-z0-9_]+$/u, "Nama login role runtime tidak valid.");
  return role;
}

test("RLS pusat memakai role NOBYPASSRLS dan mengisolasi tenant ingest", {
  skip: !ownerUrl || !registryUrl || !ingestUrl || !publicUrl || !opsUrl,
}, async (context) => {
  const owner = new Client({ connectionString: ownerUrl });
  const registry = new Client({ connectionString: registryUrl });
  const ingest = new Client({ connectionString: ingestUrl });
  const publicClient = new Client({ connectionString: publicUrl });
  const ops = new Client({ connectionString: opsUrl });
  await Promise.all([owner.connect(), registry.connect(), ingest.connect(), publicClient.connect(), ops.connect()]);
  context.after(async () => {
    await owner.query("DELETE FROM institutions WHERE id = ANY($1::uuid[])", [[institutionA, institutionB]]);
    await Promise.all([owner.end(), registry.end(), ingest.end(), publicClient.end(), ops.end()]);
  });

  await owner.query(
    `INSERT INTO institutions (id, legal_name_internal, public_slug, state, onboarded_at, created_at, updated_at)
     VALUES ($1, 'BPRS Sintetis A', 'bprs-sintetis-a', 'ACTIVE', now(), now(), now()),
            ($2, 'BPRS Sintetis B', 'bprs-sintetis-b', 'SUSPENDED', now(), now(), now())`,
    [institutionA, institutionB],
  );

  const runtimeRoles = [registryUrl, ingestUrl, publicUrl, opsUrl].map(loginRole);
  assert.equal(new Set(runtimeRoles).size, 4, "Empat scope API wajib memakai login berbeda.");
  const bypass = await owner.query(
    `SELECT rolname, rolcanlogin, rolsuper, rolbypassrls
       FROM pg_roles
       WHERE rolname = ANY($1::text[])
       ORDER BY rolname`,
    [runtimeRoles],
  );
  assert.equal(bypass.rows.length, 4);
  assert.ok(bypass.rows.every((row) => (
    row.rolcanlogin === true
    && row.rolsuper === false
    && row.rolbypassrls === false
  )));

  await registry.query("BEGIN");
  await registry.query("SELECT set_config('app.current_institution_id', $1, true)", [institutionA]);
  const registryRows = await registry.query("SELECT id FROM institutions ORDER BY id");
  assert.deepEqual(registryRows.rows.map((row) => row.id), [institutionA]);
  await assert.rejects(
    registry.query("UPDATE institutions SET updated_at = now() WHERE id = $1", [institutionA]),
    /permission denied/i,
  );
  await registry.query("ROLLBACK");

  await ingest.query("BEGIN");
  await ingest.query("SELECT set_config('app.current_institution_id', $1, true)", [institutionA]);
  const tenantRows = await ingest.query("SELECT id FROM institutions ORDER BY id");
  assert.deepEqual(tenantRows.rows.map((row) => row.id), [institutionA]);
  await assert.rejects(
    ingest.query(
      `INSERT INTO aggregate_cursors
       (id, institution_id, aggregate_type, aggregate_id, aggregate_version, expected_state, payload_checksum, updated_at)
       VALUES (gen_random_uuid(), $1, 'PUBLICATION', gen_random_uuid(), 1, 'PUBLISHED', repeat('a', 64), now())`,
      [institutionB],
    ),
    /row-level security/i,
  );
  await ingest.query("ROLLBACK");

  const publicRows = await publicClient.query("SELECT id FROM institutions ORDER BY id");
  assert.deepEqual(publicRows.rows.map((row) => row.id), [institutionA]);
  const opsRows = await ops.query("SELECT id FROM institutions WHERE id = ANY($1::uuid[]) ORDER BY id", [
    [institutionA, institutionB],
  ]);
  assert.deepEqual(opsRows.rows.map((row) => row.id), [institutionA, institutionB]);
});
