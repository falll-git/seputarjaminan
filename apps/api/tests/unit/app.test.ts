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

test("CSP API tidak menonaktifkan proteksi dan respons tetap JSON", async () => {
  const app = createApp({ config, databases, storage, ingestLimiter: new AllowAllRateLimiter(), publicLimiter: new AllowAllRateLimiter() });
  const response = await request(app).get("/health/live").expect(200);
  assert.match(response.headers["content-security-policy"], /default-src 'none'/);
  assert.match(response.headers["content-security-policy"], /frame-ancestors 'none'/);
  assert.match(response.headers["content-type"], /application\/json/);
  assert.equal(response.headers["x-content-type-options"], "nosniff");
});

test("seluruh jalur integrasi membatasi request sebelum verifikasi signature", async () => {
  for (const [method, route] of [
    ["post", "/v1/ingest/events"], ["post", "/v1/media/upload-sessions"],
    ["post", "/v1/media/upload-sessions/example/complete"], ["get", "/v1/media/example/status"],
    ["post", "/v1/reconciliation/manifests"], ["get", "/v1/reconciliation/runs/example"],
  ] as const) {
    const counts = new Map<string, number>();
    const limiter = { consume: async (key: string, limit: number) => {
      const totalHits = (counts.get(key) || 0) + 1;
      counts.set(key, totalHits);
      return { allowed: totalHits <= limit, totalHits, retryAfterSeconds: 60 };
    } };
    const app = createApp({ config: { ...config, flags: { ingest: true, mediaUpload: true, publicSite: true }, rateLimit: { publicPerMinute: 2 } }, databases, storage, ingestLimiter: limiter, publicLimiter: new AllowAllRateLimiter() });
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await request(app)[method](route).expect(401);
      assert.equal(response.body.code, "SIGNATURE_REQUIRED");
    }
    const rejected = await request(app)[method](route).expect(429);
    assert.equal(rejected.body.code, "RATE_LIMITED");
    assert.ok(Number(rejected.headers["retry-after"]) > 0);
    assert.ok([...counts.keys()].every((key) => key.startsWith("preauth:")));
  }
});

test("Redis gagal menutup akses sebelum body parser dan autentikasi", async () => {
  const app = createApp({ config, databases, storage, ingestLimiter: { consume: async () => { throw new Error("Redis unavailable"); } }, publicLimiter: new AllowAllRateLimiter() });
  const response = await request(app).post("/v1/ingest/events").set("Content-Type", "application/json").send("{").expect(503);
  assert.equal(response.body.code, "RATE_LIMIT_UNAVAILABLE");
  assert.equal(response.body.retryable, true);
  await request(app).get("/health/live").expect(200);
});
