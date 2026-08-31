import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  loadApiServerConfig,
  loadWorkerServerConfig,
  safeConfigSummary,
} from "../src/server.mjs";

const localDatabase = "postgresql://test:test@127.0.0.1:55439/seputarjaminan_test";

test("development API boleh memakai satu database disposable dan flag publik default mati", () => {
  const config = loadApiServerConfig({
    NODE_ENV: "development",
    DATABASE_URL: localDatabase,
    SJ_STORAGE_ROOT: "D:\\sj-test-storage",
  });
  assert.equal(config.ingestDatabaseUrl, localDatabase);
  assert.deepEqual(config.flags, {
    publicSite: false,
    ingest: false,
    mediaUpload: false,
  });
  assert.equal("workerDatabaseUrl" in config, false);
});

test("development worker hanya menerima credential worker dan flag default mati", () => {
  const config = loadWorkerServerConfig({
    NODE_ENV: "development",
    DATABASE_URL: localDatabase,
    SJ_STORAGE_ROOT: "D:\\sj-test-storage",
  });
  assert.equal(config.workerDatabaseUrl, localDatabase);
  assert.deepEqual(config.flags, { worker: false });
  assert.equal("opsDatabaseUrl" in config, false);
  assert.equal("redisUrl" in config, false);
});

test("TEST_SAFE ditolak untuk worker di luar automated test", () => {
  assert.throws(
    () =>
      loadWorkerServerConfig({
        NODE_ENV: "development",
        DATABASE_URL: localDatabase,
        SJ_STORAGE_ROOT: "D:\\sj-test-storage",
        SJ_MALWARE_SCAN_MODE: "TEST_SAFE",
      }),
    (error) => error.issues.some((issue) => issue.includes("TEST_SAFE")),
  );
});

test("production API menolak credential database yang dipakai bersama", () => {
  assert.throws(
    () =>
      loadApiServerConfig(
        {
          NODE_ENV: "production",
          SJ_REGISTRY_DATABASE_URL: localDatabase,
          SJ_INGEST_DATABASE_URL: localDatabase,
          SJ_PUBLIC_DATABASE_URL: localDatabase,
          SJ_OPS_DATABASE_URL: localDatabase,
          SJ_REDIS_URL: "redis://127.0.0.1:6379",
          SJ_STORAGE_ROOT: "D:\\sj-storage",
          SJ_STORAGE_STOP_FREE_BYTES: "1073741824",
          SJ_RATE_LIMIT_INGEST_PER_MINUTE: "60",
          SJ_RATE_LIMIT_PUBLIC_PER_MINUTE: "600",
          SJ_RATE_LIMIT_OPS_AUTH_PER_MINUTE: "10",
          SJ_OPS_ENCRYPTION_KEY_BASE64: "dGVzdC1vbmx5LW5vdC1hLXJlYWwta2V5",
          SJ_OPS_SESSION_SECRET: "test-only-session-secret-at-least-32-chars",
        },
        { repositoryRoot: "D:\\seputarjaminan-production" },
      ),
    (error) => error.issues.some((issue) => issue.includes("harus berbeda")),
  );
});

test("production worker tidak meminta credential API atau Redis", () => {
  const config = loadWorkerServerConfig(
    {
      NODE_ENV: "production",
      SJ_WORKER_DATABASE_URL: "postgresql://worker:secret@127.0.0.1:5432/seputarjaminan",
      SJ_STORAGE_ROOT: "D:\\sj-storage",
      SJ_STORAGE_STOP_FREE_BYTES: "1073741824",
      SJ_MALWARE_SCAN_MODE: "CLAMAV",
    },
    { repositoryRoot: "D:\\seputarjaminan-production" },
  );
  assert.equal(config.service, "worker");
  assert.equal("registryDatabaseUrl" in config, false);
  assert.equal("opsDatabaseUrl" in config, false);
  assert.equal("redisUrl" in config, false);
});

test("S3-compatible membutuhkan seluruh konfigurasi vendor tanpa perubahan kode", () => {
  assert.throws(
    () =>
      loadApiServerConfig({
        NODE_ENV: "test",
        DATABASE_URL: localDatabase,
        SJ_STORAGE_PROVIDER: "S3_COMPATIBLE",
      }),
    (error) => error.issues.some((issue) => issue.includes("SJ_S3_BUCKET")),
  );
});

test("ringkasan konfigurasi API dan worker tidak mengandung URL database atau secret", () => {
  const api = loadApiServerConfig({
    NODE_ENV: "test",
    DATABASE_URL: localDatabase,
    SJ_STORAGE_ROOT: "D:\\sj-test-storage",
  });
  const worker = loadWorkerServerConfig({
    NODE_ENV: "test",
    DATABASE_URL: localDatabase,
    SJ_STORAGE_ROOT: "D:\\sj-test-storage",
    SJ_MALWARE_SCAN_MODE: "TEST_SAFE",
  });
  const serialized = JSON.stringify([safeConfigSummary(api), safeConfigSummary(worker)]);
  assert.doesNotMatch(serialized, /postgresql|test:test/);
  assert.match(serialized, /worker-only/);
});

test("template environment memisahkan credential API, worker, dan website", () => {
  const website = readFileSync(new URL("../../../.env.example", import.meta.url), "utf8");
  const api = readFileSync(new URL("../../../apps/api/.env.example", import.meta.url), "utf8");
  const worker = readFileSync(new URL("../../../apps/worker/.env.example", import.meta.url), "utf8");

  assert.match(website, /^SJ_PUBLIC_API_BASE_URL=/m);
  assert.doesNotMatch(website, /DATABASE_URL|SECRET|ACCESS_KEY/u);
  assert.doesNotMatch(api, /^SJ_WORKER_DATABASE_URL=/m);
  assert.doesNotMatch(worker, /^SJ_(?:REGISTRY|INGEST|PUBLIC|OPS)_DATABASE_URL=/m);
  assert.doesNotMatch(worker, /^SJ_(?:REDIS_URL|OPS_ENCRYPTION_KEY_BASE64|OPS_SESSION_SECRET)=/m);
  assert.match(api, /^SJ_PUBLIC_SITE_ENABLED=false$/m);
  assert.match(api, /^SJ_INGEST_ENABLED=false$/m);
  assert.match(api, /^SJ_MEDIA_UPLOAD_ENABLED=false$/m);
  assert.match(worker, /^SJ_WORKER_ENABLED=false$/m);
});
