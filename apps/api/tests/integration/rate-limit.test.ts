import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import Redis from "ioredis";
import { RedisFixedWindowRateLimiter } from "../../src/rate-limit.js";

const redisUrl = process.env.SJ_TEST_REDIS_URL || process.env.SJ_REDIS_URL;

test("counter Redis dibagi antar instance dan koneksi awal paralel tetap valid", { skip: !redisUrl }, async () => {
  const parsed = new URL(redisUrl!);
  assert.ok(["127.0.0.1", "localhost", "redis"].includes(parsed.hostname), "Tes hanya boleh memakai Redis disposable lokal/CI.");
  assert.equal(process.env.SJ_CI_ALLOW_DISPOSABLE_DATABASE, "true");
  const key = "regression:" + randomUUID();
  const minute = Math.floor(Date.now() / 60_000);
  const first = new RedisFixedWindowRateLimiter(redisUrl!);
  const second = new RedisFixedWindowRateLimiter(redisUrl!);
  const cleanup = new Redis(redisUrl!, { lazyConnect: true, maxRetriesPerRequest: 0 });
  try {
    const initial = await Promise.all([first.consume(key, 2), first.consume(key, 2)]);
    assert.deepEqual(initial.map((value) => value.totalHits).sort(), [1, 2]);
    assert.ok(initial.every((value) => value.allowed));
    const denied = await second.consume(key, 2);
    assert.equal(denied.totalHits, 3);
    assert.equal(denied.allowed, false);
    await cleanup.connect();
    const ttl = await cleanup.ttl(`sj:rate:${key}:${minute}`);
    assert.ok(ttl > 0 && ttl <= 65);
  } finally {
    await cleanup.del(...[minute - 1, minute, minute + 1].map((value) => `sj:rate:${key}:${value}`));
    await Promise.all([first.disconnect(), second.disconnect()]);
    cleanup.disconnect();
  }
});
