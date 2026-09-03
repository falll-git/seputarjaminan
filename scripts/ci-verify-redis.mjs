import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import Redis from "ioredis";

const redisUrl = process.env.SJ_REDIS_URL?.trim();
if (!redisUrl) throw new Error("SJ_REDIS_URL wajib tersedia.");

const parsed = new URL(redisUrl);
assert.ok(new Set(["127.0.0.1", "localhost", "redis"]).has(parsed.hostname), "Redis CI harus memakai service disposable.");
assert.equal(process.env.SJ_CI_ALLOW_DISPOSABLE_DATABASE, "true", "Verifikasi Redis hanya boleh berjalan dalam CI disposable.");

const redis = new Redis(redisUrl, {
  connectTimeout: 5_000,
  commandTimeout: 5_000,
  enableOfflineQueue: false,
  lazyConnect: true,
  maxRetriesPerRequest: 0,
});
const key = `sj:ci:${randomUUID()}`;

try {
  await redis.connect();
  assert.equal(await redis.ping(), "PONG");
  assert.equal(await redis.set(key, "ok", "EX", 30), "OK");
  assert.equal(await redis.get(key), "ok");
  assert.equal(await redis.del(key), 1);
  assert.equal(await redis.exists(key), 0);
  console.log("Redis disposable terverifikasi: PING dan siklus SET/GET/DELETE lulus.");
} finally {
  redis.disconnect();
}
