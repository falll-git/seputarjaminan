import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Client } = pg;
const adminUrl = required("DATABASE_URL");
const parsed = new URL(adminUrl);
const databaseName = decodeURIComponent(parsed.pathname.slice(1));
const allowedHosts = new Set(["127.0.0.1", "localhost", "postgres"]);

assert.equal(process.env.SJ_CI_ALLOW_DISPOSABLE_DATABASE, "true", "Provisioning hanya boleh berjalan pada database disposable CI.");
assert.ok(allowedHosts.has(parsed.hostname), "Host database CI harus lokal atau service PostgreSQL GitHub Actions.");
assert.equal(databaseName, "seputarjaminan_ci", "Nama database disposable harus seputarjaminan_ci.");

const roles = [
  ["sj_ci_registry", "sj_registry", "SJ_CI_REGISTRY_PASSWORD"],
  ["sj_ci_ingest", "sj_ingest", "SJ_CI_INGEST_PASSWORD"],
  ["sj_ci_public", "sj_public", "SJ_CI_PUBLIC_PASSWORD"],
  ["sj_ci_ops", "sj_ops", "SJ_CI_OPS_PASSWORD"],
  ["sj_ci_worker", "sj_worker", "SJ_CI_WORKER_PASSWORD"],
];

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} wajib tersedia.`);
  return value;
}

function quotedIdentifier(value) {
  assert.match(value, /^[a-z][a-z0-9_]+$/u, "Nama role PostgreSQL tidak valid.");
  return `"${value}"`;
}

function quotedPassword(value) {
  assert.match(value, /^[a-f0-9]{48}$/u, "Password CI wajib berupa 48 karakter heksadesimal.");
  return `'${value}'`;
}

const client = new Client({ connectionString: adminUrl });
await client.connect();

try {
  const identity = await client.query(
    `SELECT current_database() AS database_name, rolname, rolsuper
       FROM pg_roles
      WHERE rolname = current_user`,
  );
  assert.equal(identity.rows[0]?.database_name, databaseName);
  assert.equal(identity.rows[0]?.rolsuper, true, "Provisioning CI memerlukan administrator PostgreSQL disposable.");

  const bootstrapPath = fileURLToPath(new URL("../infra/postgres/bootstrap-group-roles.sql", import.meta.url));
  await client.query(await readFile(bootstrapPath, "utf8"));

  for (const [loginRole, membershipRole, passwordVariable] of roles) {
    const password = quotedPassword(required(passwordVariable));
    const login = quotedIdentifier(loginRole);
    const membership = quotedIdentifier(membershipRole);
    await client.query(`
      DO $block$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${loginRole}') THEN
          CREATE ROLE ${login} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT NOREPLICATION NOBYPASSRLS;
        END IF;
      END
      $block$;
    `);
    await client.query(`ALTER ROLE ${login} WITH LOGIN PASSWORD ${password} NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT NOREPLICATION NOBYPASSRLS`);
    await client.query(`GRANT ${membership} TO ${login}`);
  }

  await client.query(`GRANT CONNECT ON DATABASE ${quotedIdentifier(databaseName)} TO sj_registry, sj_ingest, sj_public, sj_ops, sj_worker`);
  console.log("Database disposable siap: lima login runtime least-privilege telah diprovisikan.");
} finally {
  await client.end();
}
