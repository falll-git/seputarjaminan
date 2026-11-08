import assert from "node:assert/strict";
import type pg from "pg";

// A URL or a boolean opt-in alone is not evidence of a disposable database.
// This check is read-only and MUST precede fixture setup and cleanup hooks.
export function assertDisposableConfiguration(env: NodeJS.ProcessEnv) {
  assert.equal(env.SJ_CI_ALLOW_DISPOSABLE_DATABASE, "true", "Disposable test opt-in required");
  const marker = env.SJ_TEST_DISPOSABLE_MARKER ?? "";
  const urls = ["OWNER", "REGISTRY", "INGEST", "PUBLIC", "OPS", "WORKER"].map(scope => {
    const value = env[`SJ_TEST_${scope}_DATABASE_URL`];
    assert.ok(value, "All explicit test role URLs are required");
    let url: URL;
    try { url = new URL(value); } catch { throw new Error("Invalid test database URL (value withheld)"); }
    assert.ok(["postgres:", "postgresql:"].includes(url.protocol) && ["", "?schema=public"].includes(url.search) && !url.hash, "Test URL must not redirect the verified connection");
    return url;
  });
  const owner = urls[0];
  const local = /^OPS08:[0-9a-f-]{36}$/.test(marker) && /^\/sj_ops08_\d{8}$/.test(owner.pathname)
    && owner.hostname === "127.0.0.1" && owner.port === "55482";
  const ci = env.GITHUB_ACTIONS === "true" && /^CI:\d+:\d+$/.test(marker)
    && owner.hostname === "postgres" && owner.pathname === "/seputarjaminan_ci" && (owner.port || "5432") === "5432";
  assert.ok(local || ci, "Target is not an approved disposable database; existing workflows are protected");
  for (const url of urls) {
    assert.ok(url.hostname === owner.hostname && url.port === owner.port && url.pathname === owner.pathname, "Test roles must target one database");
  }
  assert.equal(new Set(urls.map(url => url.username)).size, 6, "Owner and five runtimes must use distinct roles");
  return { marker, database: owner.pathname.slice(1) };
}

export async function verifyDisposableDatabase(owner: pg.Client, env: NodeJS.ProcessEnv = process.env) {
  const expected = assertDisposableConfiguration(env);
  const { rows } = await owner.query("SELECT current_database() AS db, shobj_description(oid,'pg_database') AS marker FROM pg_database WHERE datname=current_database()");
  assert.equal(rows[0]?.db, expected.database, "Connected test database differs from declared target");
  assert.equal(rows[0]?.marker, expected.marker, "Database ownership marker does not match");
}
