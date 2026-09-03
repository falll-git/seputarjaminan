import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
  loadApiServerConfig,
  loadWorkerServerConfig,
  safeConfigSummary,
} from "../src/server.mjs";
import { loadWebsiteConfig } from "../src/public.mjs";

const localDatabase = "postgresql://test:test@127.0.0.1:55439/seputarjaminan_test";
const repositoryRoot = resolve("seputarjaminan-test-repository");
const storageRoot = join(tmpdir(), "seputarjaminan-test-storage");

test("development API boleh memakai satu database disposable dan flag publik default mati", () => {
  const config = loadApiServerConfig({
    NODE_ENV: "development",
    DATABASE_URL: localDatabase,
    SJ_STORAGE_ROOT: storageRoot,
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
    SJ_STORAGE_ROOT: storageRoot,
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
        SJ_STORAGE_ROOT: storageRoot,
        SJ_MALWARE_SCAN_MODE: "TEST_SAFE",
      }),
    (error) => error.issues.some((issue) => issue.includes("TEST_SAFE")),
  );
});

test("website production mewajibkan origin API HTTPS dan hanya mengizinkan loopback secara eksplisit", () => {
  const production = loadWebsiteConfig({
    NODE_ENV: "production",
    SJ_PUBLIC_API_BASE_URL: "https://api.seputarjaminan.example.test",
  });
  assert.equal(production.publicApiBaseUrl, "https://api.seputarjaminan.example.test");
  assert.throws(
    () =>
      loadWebsiteConfig({
        NODE_ENV: "production",
        SJ_PUBLIC_API_BASE_URL: "http://api.seputarjaminan.example.test",
      }),
    (error) => error.issues.some((issue) => issue.includes("HTTPS")),
  );
  assert.equal(
    loadWebsiteConfig({
      NODE_ENV: "production",
      SJ_PUBLIC_API_BASE_URL: "http://127.0.0.1:4100",
      SJ_ALLOW_LOOPBACK_API: "true",
    }).publicApiBaseUrl,
    "http://127.0.0.1:4100",
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
          SJ_STORAGE_ROOT: storageRoot,
          SJ_STORAGE_STOP_FREE_BYTES: "1073741824",
          SJ_RATE_LIMIT_INGEST_PER_MINUTE: "60",
          SJ_RATE_LIMIT_PUBLIC_PER_MINUTE: "600",
          SJ_RATE_LIMIT_OPS_AUTH_PER_MINUTE: "10",
          SJ_OPS_ENCRYPTION_KEY_BASE64: "dGVzdC1vbmx5LW5vdC1hLXJlYWwta2V5", // gitleaks:allow -- invalid test-only placeholder
          SJ_OPS_SESSION_SECRET: "test-only-session-secret-at-least-32-chars",
        },
        { repositoryRoot },
      ),
    (error) => error.issues.some((issue) => issue.includes("harus berbeda")),
  );
});

test("production worker tidak meminta credential API atau Redis", () => {
  const config = loadWorkerServerConfig(
    {
      NODE_ENV: "production",
      SJ_WORKER_DATABASE_URL: "postgresql://worker:secret@127.0.0.1:5432/seputarjaminan",
      SJ_STORAGE_ROOT: storageRoot,
      SJ_STORAGE_STOP_FREE_BYTES: "1073741824",
      SJ_MALWARE_SCAN_MODE: "CLAMAV",
    },
    { repositoryRoot },
  );
  assert.equal(config.service, "worker");
  assert.equal("registryDatabaseUrl" in config, false);
  assert.equal("opsDatabaseUrl" in config, false);
  assert.equal("redisUrl" in config, false);
});

test("production API menerima empat role least-privilege pada database pusat yang sama", () => {
  const target = "database.internal:5432/seputarjaminan?schema=public";
  const config = loadApiServerConfig(
    {
      NODE_ENV: "production",
      SJ_REGISTRY_DATABASE_URL: `postgresql://sj_registry:registry-pass@${target}`,
      SJ_INGEST_DATABASE_URL: `postgresql://sj_ingest:ingest-pass@${target}`,
      SJ_PUBLIC_DATABASE_URL: `postgresql://sj_public:public-pass@${target}`,
      SJ_OPS_DATABASE_URL: `postgresql://sj_ops:ops-pass@${target}`,
      SJ_REDIS_URL: "redis://redis.internal:6379/0",
      SJ_PUBLIC_API_BASE_URL: "https://api.seputarjaminan.example.test",
      SJ_PUBLIC_MEDIA_BASE_URL:
        "https://api.seputarjaminan.example.test/v1/public/media",
      SJ_STORAGE_ROOT: storageRoot,
      SJ_STORAGE_STOP_FREE_BYTES: "1073741824",
      SJ_RATE_LIMIT_INGEST_PER_MINUTE: "60",
      SJ_RATE_LIMIT_PUBLIC_PER_MINUTE: "600",
      SJ_RATE_LIMIT_OPS_AUTH_PER_MINUTE: "10",
      SJ_OPS_ENCRYPTION_KEY_BASE64: Buffer.alloc(32, 9).toString("base64"),
      SJ_OPS_SESSION_SECRET: "x".repeat(48),
    },
    { repositoryRoot },
  );
  assert.equal(config.service, "api");
  assert.equal(safeConfigSummary(config).databaseCredentialsSeparated, true);
});

test("production menolak superuser, target database berbeda, Redis salah, dan URL publik tidak aman", () => {
  const target = "database.internal:5432/seputarjaminan?schema=public";
  assert.throws(
    () =>
      loadApiServerConfig(
        {
          NODE_ENV: "production",
          SJ_REGISTRY_DATABASE_URL: `postgresql://postgres:registry-pass@${target}`,
          SJ_INGEST_DATABASE_URL: `postgresql://sj_ingest:ingest-pass@${target}`,
          SJ_PUBLIC_DATABASE_URL:
            "postgresql://sj_public:public-pass@database.internal:5432/database_lain?schema=public",
          SJ_OPS_DATABASE_URL: `postgresql://sj_ops:ops-pass@${target}`,
          SJ_REDIS_URL: "https://redis.internal:6379",
          SJ_PUBLIC_API_BASE_URL: "http://api.example.test/path",
          SJ_PUBLIC_MEDIA_BASE_URL: "https://media.example.test/v1/public/media",
          SJ_STORAGE_ROOT: storageRoot,
          SJ_STORAGE_STOP_FREE_BYTES: "1073741824",
          SJ_RATE_LIMIT_INGEST_PER_MINUTE: "60",
          SJ_RATE_LIMIT_PUBLIC_PER_MINUTE: "600",
          SJ_RATE_LIMIT_OPS_AUTH_PER_MINUTE: "10",
          SJ_OPS_ENCRYPTION_KEY_BASE64: "bukan-base64",
          SJ_OPS_SESSION_SECRET: "x".repeat(48),
        },
        { repositoryRoot },
      ),
    (error) => {
      const message = error.issues.join("\n");
      return /superuser/.test(message)
        && /database Seputar Jaminan yang sama/.test(message)
        && /protocol redis/.test(message)
        && /wajib HTTPS/.test(message)
        && /base64 kanonis 32 byte/.test(message);
    },
  );
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
    SJ_STORAGE_ROOT: storageRoot,
  });
  const worker = loadWorkerServerConfig({
    NODE_ENV: "test",
    DATABASE_URL: localDatabase,
    SJ_STORAGE_ROOT: storageRoot,
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
  assert.match(api, /^SJ_STORAGE_PROVIDER=FILESYSTEM$/m);
  assert.match(api, /^SJ_S3_ENDPOINT=$/m);
  assert.match(api, /^SJ_S3_SECRET_ACCESS_KEY=$/m);
  assert.match(worker, /^SJ_MALWARE_SCAN_MODE=CLAMAV$/m);
  assert.match(worker, /^SJ_CLAMDSCAN_COMMAND=clamdscan$/m);
  assert.doesNotMatch(
    website + api + worker,
    /BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY|(?:ghp|github_pat)_[A-Za-z0-9_]{20,}/u,
  );
});
