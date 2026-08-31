import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { AllowAllRateLimiter } from "../../src/rate-limit.js";

const config = {
  flags: { ingest: false, mediaUpload: false, publicSite: false },
  security: {
    eventBodyMaxBytes: 262144,
    mediaFileMaxBytes: 10485760,
    mediaTotalMaxBytes: 52428800,
    signatureToleranceSeconds: 300,
    nonceTtlSeconds: 600,
  },
  rateLimit: {},
  publicMediaBaseUrl: "http://127.0.0.1:4100/v1/public/media",
  publicApiBaseUrl: "http://127.0.0.1:4100",
  uploadSessionTtlSeconds: 300,
  storage: { provider: "FILESYSTEM" },
};

const databases = {
  registry: { $queryRaw: async () => [{ value: 1 }] },
  ingest: {},
  publicRead: {},
  ops: {},
} as any;
const storage = {};

test("live dan ready tidak membocorkan konfigurasi", async () => {
  const app = createApp({
    config,
    databases,
    storage,
    ingestLimiter: new AllowAllRateLimiter(),
    publicLimiter: new AllowAllRateLimiter(),
  });
  const live = await request(app).get("/health/live").expect(200);
  assert.equal(live.body.status, "OK");
  assert.doesNotMatch(JSON.stringify(live.body), /database|password|storage/i);
  await request(app).get("/health/ready").expect(200);
});

test("feature flag mati menghasilkan status jujur tanpa data dummy", async () => {
  const app = createApp({
    config,
    databases,
    storage,
    ingestLimiter: new AllowAllRateLimiter(),
    publicLimiter: new AllowAllRateLimiter(),
  });
  const response = await request(app).get("/v1/public/assets").expect(503);
  assert.equal(response.body.code, "PUBLIC_SITE_DISABLED");
  assert.equal(response.body.retryable, false);
  assert.equal(response.body.items, undefined);
});

test("unknown route memakai error contract aman", async () => {
  const app = createApp({
    config,
    databases,
    storage,
    ingestLimiter: new AllowAllRateLimiter(),
    publicLimiter: new AllowAllRateLimiter(),
  });
  const response = await request(app).get("/route-tidak-ada").expect(404);
  assert.equal(response.body.code, "NOT_FOUND");
  assert.match(response.body.request_id, /^[0-9a-f-]{36}$/i);
});
