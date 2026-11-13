import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, realpathSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import net from "node:net";
import { parse } from "dotenv";
import { splitEnvironment, splitLocalFiles, serialize } from "../scripts/split-local-environment.mjs";
import { validateProfile, validateProfiles, childEnvironment, assertWebsiteEnvFiles, databaseIdentity, apiDatabaseKeys } from "../scripts/local-environment.mjs";
import { assertPortFree } from "../scripts/local-runtime.mjs";

// In-memory/file-only configuration specimens. No real DB/storage/service is contacted.
function specimen() {
  return {
    NODE_ENV: "development", DATABASE_URL: "postgresql://owner:fixture-only@127.0.0.1:1/ops01_fixture",
    ...Object.fromEntries([...apiDatabaseKeys, "SJ_WORKER_DATABASE_URL"].map((key, index) => [key, `postgresql://scope${index}:fixture-only@127.0.0.1:1/ops01_fixture`])),
    SJ_API_HOST: "127.0.0.1", SJ_API_PORT: "4410", SJ_REDIS_URL: "redis://127.0.0.1:1",
    SJ_PUBLIC_API_BASE_URL: "http://127.0.0.1:4410", SJ_PUBLIC_MEDIA_BASE_URL: "http://127.0.0.1:4410/v1/public/media",
    SJ_STORAGE_PROVIDER: "FILESYSTEM", SJ_STORAGE_ROOT: path.join(os.tmpdir(), "ops01-unused-storage"),
    SJ_PUBLIC_SITE_ENABLED: "true", SJ_INGEST_ENABLED: "true", SJ_MEDIA_UPLOAD_ENABLED: "true", SJ_WORKER_ENABLED: "true", SJ_MALWARE_SCAN_MODE: "TEST_SAFE",
  };
}
function temporary(t) {
  const base = realpathSync(os.tmpdir());
  const directory = mkdtempSync(path.join(base, "sj-ops01-config-test-"));
  t.after(() => {
    const resolved = realpathSync(directory);
    assert.equal(path.dirname(resolved), base);
    assert.ok(path.basename(resolved).startsWith("sj-ops01-config-test-"));
    rmSync(resolved, { recursive: true });
  });
  return directory;
}
test("separation retains exact credentials while locking all activation and fixing scanner", () => {
  const original = specimen();
  const profiles = splitEnvironment(original);
  assert.deepEqual(Object.keys(profiles.website), ["SJ_PUBLIC_API_BASE_URL"]);
  assert.deepEqual(profiles.migration, { DATABASE_URL: original.DATABASE_URL });
  assert.equal(profiles.worker.SJ_WORKER_DATABASE_URL, original.SJ_WORKER_DATABASE_URL);
  assert.equal(profiles.worker.NODE_ENV, "development");
  assert.equal(profiles.worker.SJ_MALWARE_SCAN_MODE, "CLAMAV");
  assert.equal(profiles.worker.SJ_WORKER_ENABLED, "false");
  for (const key of apiDatabaseKeys) assert.equal(profiles.api[key], original[key]);
  assert.equal(profiles.api.SJ_INGEST_ENABLED, "false");
  assert.equal(profiles.api.SJ_PUBLIC_SITE_ENABLED, "false");
  assert.equal(profiles.api.SJ_MEDIA_UPLOAD_ENABLED, "false");
  assert.equal(profiles.api.SJ_CONTROL_MONITORING_ENABLED, "false");
  assert.ok(!Object.hasOwn(profiles.api, "DATABASE_URL"));
  assert.ok(!Object.hasOwn(profiles.api, "SJ_WORKER_DATABASE_URL"));
});
for (const scope of ["website", "api", "worker"]) {
  test(`${scope} rejects owner credential contamination`, () => {
    const profiles = splitEnvironment(specimen());
    assert.throws(() => validateProfile(scope, { ...profiles[scope], DATABASE_URL: specimen().DATABASE_URL }), /OUT_OF_SCOPE_CONFIG/);
  });
}
test("all processes reject unknown keys instead of silently dropping typos", () => {
  assert.throws(() => splitEnvironment({ ...specimen(), SJ_WORKER_ENABLE: "true" }), /UNKNOWN_SOURCE_CONFIG/);
  assert.throws(() => validateProfile("migration", { DATABASE_URL: specimen().DATABASE_URL, SJ_INGEST_ENABLED: "true" }), /OUT_OF_SCOPE_CONFIG/);
});
test("missing role URL cannot fall back to owner or a shared runtime URL", () => {
  const profiles = splitEnvironment(specimen());
  delete profiles.api.SJ_PUBLIC_DATABASE_URL;
  assert.throws(() => validateProfiles(profiles), /INVALID_DATABASE_CONFIG/);
});
test("same login, mismatched DB, and worker/owner cross-scope reuse rejected", () => {
  for (const mutation of [
    (p) => { p.api.SJ_PUBLIC_DATABASE_URL = p.api.SJ_INGEST_DATABASE_URL; },
    (p) => { p.worker.SJ_WORKER_DATABASE_URL = p.migration.DATABASE_URL; },
    (p) => { p.worker.SJ_WORKER_DATABASE_URL += "_other"; },
  ]) {
    const profiles = splitEnvironment(specimen()); mutation(profiles);
    assert.throws(() => validateProfiles(profiles), /DATABASE_SCOPE/);
  }
});
test("nonlocal, privileged, and redirected database targets rejected", () => {
  assert.throws(() => databaseIdentity("postgresql://user:pass@example.com/data"), /LOCAL/);
  assert.throws(() => databaseIdentity(`${specimen().DATABASE_URL}?host=example.com`), /PARAMETER/);
  const profiles = splitEnvironment(specimen());
  profiles.worker.SJ_WORKER_DATABASE_URL = profiles.worker.SJ_WORKER_DATABASE_URL.replace("scope4:", "postgres:");
  assert.throws(() => validateProfiles(profiles), /PRIVILEGED/);
});
test("development never uses TEST_SAFE or masquerades as NODE_ENV=test", () => {
  const profiles = splitEnvironment(specimen());
  for (const NODE_ENV of ["test", "production", ""]) assert.throws(() => validateProfile("worker", { ...profiles.worker, NODE_ENV }), /DEVELOPMENT/);
  assert.throws(() => validateProfile("worker", { ...profiles.worker, SJ_MALWARE_SCAN_MODE: "TEST_SAFE" }), /CLAMAV/);
});
test("activation and Redis omissions fail closed", () => {
  const profiles = splitEnvironment(specimen());
  for (const key of ["SJ_INGEST_ENABLED", "SJ_PUBLIC_SITE_ENABLED", "SJ_MEDIA_UPLOAD_ENABLED", "SJ_CONTROL_MONITORING_ENABLED"]) assert.throws(() => validateProfile("api", { ...profiles.api, [key]: "true" }), /ACTIVATION_LOCKED/);
  assert.throws(() => validateProfile("worker", { ...profiles.worker, SJ_WORKER_ENABLED: "true" }), /ACTIVATION_LOCKED/);
  assert.throws(() => validateProfile("api", { ...profiles.api, SJ_REDIS_URL: "" }), /REDIS/);
});
test("website endpoint, media and API port must agree", () => {
  for (const mutate of [
    (p) => { p.website.SJ_PUBLIC_API_BASE_URL = "http://127.0.0.1:4431"; },
    (p) => { p.api.SJ_API_PORT = "4431"; },
    (p) => { p.api.SJ_PUBLIC_MEDIA_BASE_URL = "http://127.0.0.1:4431/v1/public/media"; },
    (p) => { p.website.SJ_PUBLIC_API_BASE_URL = "http://user:secret@127.0.0.1:4410"; },
  ]) {
    const profiles = splitEnvironment(specimen()); mutate(profiles);
    assert.throws(() => validateProfiles(profiles));
  }
});
test("inherited secrets, preload and test/preview flags cannot reach website child", () => {
  const environment = childEnvironment("website", splitEnvironment(specimen()).website, { PATH: process.env.PATH || process.env.Path, SystemRoot: process.env.SystemRoot, NODE_ENV: "test", NODE_OPTIONS: "--import injected", DATABASE_URL: "secret", SJ_SAMPLE_PREVIEW: "true", AWS_SECRET_ACCESS_KEY: "secret" });
  const child = spawnSync(process.execPath, ["-e", "console.log(JSON.stringify(Object.keys(process.env)))"], { env: environment, encoding: "utf8" });
  assert.equal(child.status, 0);
  const keys = JSON.parse(child.stdout);
  for (const key of ["DATABASE_URL", "NODE_OPTIONS", "NODE_ENV", "SJ_SAMPLE_PREVIEW", "AWS_SECRET_ACCESS_KEY"]) assert.ok(!keys.includes(key));
  assert.ok(keys.includes("SJ_PUBLIC_API_BASE_URL"));
});
test("Next auto-loaded env contamination is rejected before launch", (t) => {
  const root = temporary(t);
  for (const name of [".env", ".env.local", ".env.development", ".env.development.local", ".env.production.local", ".env.test"]) {
    writeFileSync(path.join(root, name), "DATABASE_URL=fixture-only\n");
    assert.throws(() => assertWebsiteEnvFiles(root), /OUT_OF_SCOPE_CONFIG/);
    writeFileSync(path.join(root, name), "SJ_PUBLIC_API_BASE_URL=http://127.0.0.1:4410\n");
  }
  assert.doesNotThrow(() => assertWebsiteEnvFiles(root));
});
test("literal dotenv credentials round-trip special characters without expansion", () => {
  const values = { DATABASE_URL: "postgresql://user:p$ss#word!@127.0.0.1/db" };
  assert.deepEqual(parse(serialize(values)), values);
  assert.throws(() => serialize({ KEY: "cannot'quote" }), /MANUAL_SPLIT/);
});
test("split backs up exactly, is resumable, and refuses divergent edits", (t) => {
  const root = temporary(t);
  const directory = path.join(root, "private"); mkdirSync(directory);
  const original = serialize(specimen());
  writeFileSync(path.join(root, ".env.local"), original);
  splitLocalFiles(root, directory);
  assert.equal(readFileSync(path.join(directory, "combined-before-ops01.env"), "utf8"), original);
  assert.deepEqual(Object.keys(parse(readFileSync(path.join(root, ".env.local")))), ["SJ_PUBLIC_API_BASE_URL"]);
  assert.doesNotThrow(() => splitLocalFiles(root, directory));
  const changed = readFileSync(path.join(directory, "worker.env"), "utf8") + "# operator change\n";
  writeFileSync(path.join(directory, "worker.env"), changed);
  assert.throws(() => splitLocalFiles(root, directory), /NO_OVERWRITE/);
  assert.equal(readFileSync(path.join(directory, "worker.env"), "utf8"), changed);
});
test("resume after backup-only interruption creates the remaining profiles", (t) => {
  const root = temporary(t); const directory = path.join(root, "private"); mkdirSync(directory);
  const original = serialize(specimen());
  writeFileSync(path.join(root, ".env.local"), original);
  writeFileSync(path.join(directory, "combined-before-ops01.env"), original);
  assert.doesNotThrow(() => splitLocalFiles(root, directory));
  assert.equal(parse(readFileSync(path.join(directory, "worker.env"))).SJ_WORKER_ENABLED, "false");
});

test("matching fsynced pending backup is published once and resumes the split", (t) => {
  const root = temporary(t); const directory = path.join(root, "private"); mkdirSync(directory);
  const original = serialize(specimen());
  writeFileSync(path.join(root, ".env.local"), original);
  writeFileSync(path.join(directory, "combined-before-ops01.env.pending"), original);
  assert.doesNotThrow(() => splitLocalFiles(root, directory));
  assert.equal(readFileSync(path.join(directory, "combined-before-ops01.env"), "utf8"), original);
  assert.throws(() => readFileSync(path.join(directory, "combined-before-ops01.env.pending")), { code: "ENOENT" });
  assert.doesNotThrow(() => splitLocalFiles(root, directory));
});

test("a divergent pending backup remains intact and cannot replace the source", (t) => {
  const root = temporary(t); const directory = path.join(root, "private"); mkdirSync(directory);
  const original = serialize(specimen());
  writeFileSync(path.join(root, ".env.local"), original);
  writeFileSync(path.join(directory, "combined-before-ops01.env.pending"), "operator contents\n");
  assert.throws(() => splitLocalFiles(root, directory), /INCOMPLETE_PENDING_FILE_REQUIRES_REVIEW/);
  assert.equal(readFileSync(path.join(root, ".env.local"), "utf8"), original);
  assert.equal(readFileSync(path.join(directory, "combined-before-ops01.env.pending"), "utf8"), "operator contents\n");
  assert.throws(() => readFileSync(path.join(directory, "combined-before-ops01.env")), { code: "ENOENT" });
});

test("a competing profile published after validation cannot be overwritten or replace the source", (t) => {
  const root = temporary(t); const directory = path.join(root, "private"); mkdirSync(directory);
  const original = serialize(specimen());
  writeFileSync(path.join(root, ".env.local"), original);
  const child = spawnSync(process.execPath, ["--input-type=module", "-e", `
    import assert from "node:assert/strict";
    import fs from "node:fs";
    import path from "node:path";
    import { syncBuiltinESMExports } from "node:module";
    const [root, directory, moduleUrl] = process.argv.slice(1);
    const target = path.join(directory, "api.env");
    const source = fs.readFileSync(path.join(root, ".env.local"), "utf8");
    const competitor = "operator profile created concurrently\\n";
    let injected = false;
    // Model the competing writer at publication, after plan validation. Cover
    // both rename replacement (the old bug) and create-only link publication.
    for (const operation of ["linkSync", "renameSync"]) {
      const originalOperation = fs[operation];
      fs[operation] = (...args) => {
        if (args[1] === target && !injected) {
          fs.writeFileSync(target, competitor, { flag: "wx", mode: 0o600 });
          injected = true;
        }
        return originalOperation(...args);
      };
    }
    syncBuiltinESMExports();
    const { splitLocalFiles } = await import(moduleUrl);
    assert.throws(() => splitLocalFiles(root, directory), /EXISTING_CONFIG_DIFFERS_NO_OVERWRITE/);
    assert.equal(injected, true);
    assert.equal(fs.readFileSync(target, "utf8"), competitor);
    assert.equal(fs.readFileSync(path.join(root, ".env.local"), "utf8"), source);
    assert.equal(fs.readFileSync(path.join(directory, "combined-before-ops01.env"), "utf8"), source);
    assert.throws(() => fs.readFileSync(path.join(directory, "worker.env")), { code: "ENOENT" });
    console.log("RACE_REJECTED_SOURCE_AND_BACKUP_PRESERVED");
  `, root, directory, new URL("../scripts/split-local-environment.mjs", import.meta.url).href], {
    encoding: "utf8", windowsHide: true, timeout: 15000,
  });
  assert.equal(child.error, undefined);
  assert.equal(child.signal, null);
  assert.equal(child.status, 0, child.stderr);
  assert.equal(child.stdout.trim(), "RACE_REJECTED_SOURCE_AND_BACKUP_PRESERVED");
  assert.equal(readFileSync(path.join(root, ".env.local"), "utf8"), original);
});
test("existing listener blocks a second local start", async () => {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try { await assert.rejects(assertPortFree("127.0.0.1", server.address().port), /NO_DUPLICATE_START/); }
  finally { await new Promise((resolve) => server.close(resolve)); }
});
