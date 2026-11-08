import assert from "node:assert/strict";
import test from "node:test";
import { assertDisposableConfiguration, verifyDisposableDatabase } from "../integration/disposable-target.js";
const marker = "OPS08:00000000-0000-4000-8000-000000000001";
function config(): NodeJS.ProcessEnv {
  return { SJ_CI_ALLOW_DISPOSABLE_DATABASE: "true", SJ_TEST_DISPOSABLE_MARKER: marker,
    ...Object.fromEntries(["OWNER", "REGISTRY", "INGEST", "PUBLIC", "OPS", "WORKER"].map(r => [`SJ_TEST_${r}_DATABASE_URL`, `postgresql://${r.toLowerCase()}:test@127.0.0.1:55482/sj_ops08_20260917`])) };
}
test("mutative integration rejects operational, old shared targets and mismatched roles before querying", async () => {
  for (const change of [{ SJ_CI_ALLOW_DISPOSABLE_DATABASE: "false" }, { SJ_TEST_DISPOSABLE_MARKER: "" },
    { SJ_TEST_OWNER_DATABASE_URL: "postgresql://owner:test@127.0.0.1:5432/seputarjaminan_ci" },
    { SJ_TEST_OWNER_DATABASE_URL: "postgresql://owner:test@127.0.0.1:55482/sj_ops_prereq_20260916" },
    { SJ_TEST_PUBLIC_DATABASE_URL: "postgresql://public:test@127.0.0.1:55482/production" }]) {
    let reads = 0;
    await assert.rejects(verifyDisposableDatabase({ query: async () => { reads++; return { rows: [] }; } } as any, { ...config(), ...change }));
    assert.equal(reads, 0);
  }
});
test("disposable marker must match database evidence; CI requires isolated service host", async () => {
  const env = config();assert.equal(assertDisposableConfiguration(env).marker, marker);
  await assert.rejects(verifyDisposableDatabase({ query: async () => ({ rows: [{ db: 'sj_ops08_20260917', marker: 'old-workflow' }] }) } as any, env));
  await verifyDisposableDatabase({ query: async () => ({ rows: [{ db: 'sj_ops08_20260917', marker }] }) } as any, env);
  const ci = { ...env, GITHUB_ACTIONS: "true", SJ_TEST_DISPOSABLE_MARKER: "CI:123:1", ...Object.fromEntries(["OWNER", "REGISTRY", "INGEST", "PUBLIC", "OPS", "WORKER"].map(r => [`SJ_TEST_${r}_DATABASE_URL`, `postgresql://${r.toLowerCase()}:test@postgres:5432/seputarjaminan_ci?schema=public`])) };
  assert.equal(assertDisposableConfiguration(ci).database, "seputarjaminan_ci");
  assert.throws(() => assertDisposableConfiguration({ ...ci, GITHUB_ACTIONS: "false" }));
  assert.throws(() => assertDisposableConfiguration({ ...ci, SJ_TEST_OWNER_DATABASE_URL: "postgresql://owner:test@localhost:5432/seputarjaminan_ci" }));
  assert.throws(() => assertDisposableConfiguration({ ...env, SJ_TEST_OWNER_DATABASE_URL: env.SJ_TEST_OWNER_DATABASE_URL + "?host=production" }));
});
