import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import request from "supertest";
import { rateLimitMiddleware, RedisFixedWindowRateLimiter } from "../../src/rate-limit.js";
import { errorHandler, requestContext } from "../../src/errors.js";

test("limiter mempertahankan batas, Retry-After, dan isolasi key", async () => {
  const counts = new Map<string, number>();
  const limiter = { consume: async (key: string, limit: number) => {
    const totalHits = (counts.get(key) || 0) + 1;
    counts.set(key, totalHits);
    return { totalHits, allowed: totalHits <= limit, retryAfterSeconds: 30 };
  } };
  const app = express();
  app.use(requestContext);
  app.get("/:key", rateLimitMiddleware({ limiter, limit: 2, key: (req) => String(req.params.key) }), (_req, res) => res.sendStatus(204));
  app.use(errorHandler);
  await request(app).get("/a").expect(204);
  await request(app).get("/a").expect(204);
  const response = await request(app).get("/a").expect(429);
  assert.equal(response.body.code, "RATE_LIMITED");
  assert.equal(response.body.retry_after_seconds, 30);
  await request(app).get("/b").expect(204);
});

test("hasil transaksi Redis kosong, error, atau counter rusak ditolak fail-closed", async () => {
  for (const result of [null, [], [[new Error("counter unavailable"), null], [null, 1]], [[null, 0], [null, 1]], [[null, 1], [null, 0]], [[null, "invalid"], [null, 1]]]) {
    const limiter = new RedisFixedWindowRateLimiter("redis://127.0.0.1:1");
    const transaction = { incr: () => transaction, expire: () => transaction, exec: async () => result };
    (limiter as any).redis = { status: "ready", multi: () => transaction };
    await assert.rejects(() => limiter.consume("test", 2), /Redis rate-limit/);
  }
});

test("counter Redis yang sah tetap menentukan allowed dan totalHits", async () => {
  const limiter = new RedisFixedWindowRateLimiter("redis://127.0.0.1:1");
  const transaction = { incr: () => transaction, expire: () => transaction, exec: async () => [[null, 3], [null, 1]] };
  (limiter as any).redis = { status: "ready", multi: () => transaction };
  const result = await limiter.consume("test", 2);
  assert.equal(result.totalHits, 3);
  assert.equal(result.allowed, false);
  assert.ok(result.retryAfterSeconds > 0 && result.retryAfterSeconds <= 60);
});
