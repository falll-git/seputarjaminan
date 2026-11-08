import assert from "node:assert/strict";
import { readFileSync, realpathSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import type pg from "pg";
import { verifyDisposableDatabase } from "./disposable-target.ts";

// Opt-in integration only. No production/runtime fallback and no secret output.
export async function verifyRealLocalServices(owner: pg.Client) {
  const file = process.env.SJ_TEST_LOCAL_TARGET_FILE;
  if (!file) return undefined;
  if (path.resolve(file).toLowerCase() === path.resolve("D:/seputarjaminan-local/services/ops08-target.json").toLowerCase()) {
    await verifyDisposableDatabase(owner);
    const target = JSON.parse(readFileSync(file, "utf8"));
    const base = JSON.parse(readFileSync("D:/seputarjaminan-local/services/integration-target.json", "utf8"));
    const inspect = (name: string) => JSON.parse(execFileSync("docker", ["inspect", name], { encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }))[0];
    const pgInfo = inspect(base.container);
    assert.equal(pgInfo.Config.Labels["sj.ops02.marker"], base.marker);
    assert.equal(pgInfo.Mounts[0].Name, base.volume);
    assert.deepEqual(pgInfo.HostConfig.PortBindings["5432/tcp"], [{ HostIp: "127.0.0.1", HostPort: "55482" }]);
    for (const scope of ["owner", "registry", "ingest", "public", "ops", "worker"]) assert.ok(process.env[`SJ_TEST_${scope.toUpperCase()}_DATABASE_URL`] === target.urls[scope], "Test credential differs from target");
    assert.equal((await owner.query("SELECT system_identifier::text id FROM pg_control_system()")).rows[0].id, target.systemIdentifier);
    const root = realpathSync(target.storage);
    assert.equal(path.dirname(root).toLowerCase(), path.resolve("D:/seputarjaminan-local/storage/integration-tests").toLowerCase());
    assert.ok(path.basename(root).startsWith("ops08-"));
    assert.deepEqual(JSON.parse(readFileSync(path.join(root, "ops08-owner.json"), "utf8")), { database: target.database, marker: target.marker, storage: target.storage });
    const services = JSON.parse(readFileSync("D:/seputarjaminan-local/services/target.json", "utf8"));
    for (const [kind, service] of Object.entries<any>(services.services)) {
      assert.equal(service.name, `sj-ops-local-${kind}-20260916`);
      const info = inspect(service.name);
      assert.equal(info.Config.Labels["sj.prerequisites.marker"], services.marker);
      assert.equal(info.State.Running, true);
      assert.equal(info.Mounts.filter((m: any) => m.Type === "volume")[0].Name, service.volume);
      assert.deepEqual(info.HostConfig.PortBindings, kind === "redis" ? { "6379/tcp": [{ HostIp: "127.0.0.1", HostPort: "56380" }] } : {});
    }
    return { storageBase: root, redisUrl: `redis://:${services.redisPassword}@127.0.0.1:56380/1`, dockerContainer: services.services.clamav.name as string };
  }
  assert.equal(path.resolve(file).toLowerCase(), path.resolve("D:/seputarjaminan-local/services/integration-target.json").toLowerCase());
  const target = JSON.parse(readFileSync(file, "utf8"));
  assert.equal(target.database, "sj_ops_prereq_20260916");
  assert.equal(target.port, 55482);
  const inspect = (name: string) => JSON.parse(execFileSync("docker", ["inspect", name], { encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }))[0];
  const pgInfo = inspect(target.container);
  assert.equal(pgInfo.Config.Labels["sj.ops02.marker"], target.marker);
  assert.equal(pgInfo.Mounts[0].Name, target.volume);
  assert.deepEqual(pgInfo.HostConfig.PortBindings["5432/tcp"], [{ HostIp: "127.0.0.1", HostPort: "55482" }]);
  for (const scope of ["owner", "registry", "ingest", "public", "ops", "worker"]) {
    assert.ok(process.env[`SJ_TEST_${scope.toUpperCase()}_DATABASE_URL`] === target.urls[scope], "Test credential differs from verified target");
    const url = new URL(target.urls[scope]);
    assert.equal(url.hostname, "127.0.0.1"); assert.equal(url.port, "55482"); assert.equal(url.pathname, "/" + target.database); assert.equal(url.search, "");
  }
  assert.equal((await owner.query("SELECT current_database() db")).rows[0].db, target.database);
  assert.equal((await owner.query("SELECT system_identifier::text id FROM pg_control_system()")).rows[0].id, target.systemIdentifier);
  assert.equal((await owner.query("SELECT shobj_description(oid,'pg_database') marker FROM pg_database WHERE datname=current_database()")).rows[0].marker, `OPS-PREREQUISITES:${target.marker}`);
  assert.equal(path.resolve(target.storage).toLowerCase(), path.resolve("D:/seputarjaminan-local/storage/integration-tests").toLowerCase());
  assert.equal(realpathSync(target.storage).toLowerCase(), path.resolve(target.storage).toLowerCase());
  assert.deepEqual(JSON.parse(readFileSync(path.join(target.storage, "target-marker.json"), "utf8")), { database: target.database, marker: target.marker });
  const services = JSON.parse(readFileSync("D:/seputarjaminan-local/services/target.json", "utf8"));
  assert.equal(services.redisPort, 56380);
  for (const [kind, service] of Object.entries<any>(services.services)) {
    assert.equal(service.name, `sj-ops-local-${kind}-20260916`);
    const info = inspect(service.name);
    assert.equal(info.Config.Labels["sj.prerequisites.marker"], services.marker);
    assert.equal(info.State.Running, true);
    assert.equal(info.Mounts.filter((mount: any) => mount.Type === "volume")[0].Name, service.volume);
    if (kind === "redis") assert.deepEqual(info.HostConfig.PortBindings, { "6379/tcp": [{ HostIp: "127.0.0.1", HostPort: "56380" }] });
    else assert.deepEqual(info.HostConfig.PortBindings, {});
  }
  return { storageBase: target.storage as string, redisUrl: `redis://:${services.redisPassword}@127.0.0.1:56380/1`, dockerContainer: services.services.clamav.name as string };
}
