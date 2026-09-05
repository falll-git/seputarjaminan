import type { RequestHandler } from "express";
import Redis from "ioredis";
import { rateLimit, type RateLimitInfo } from "express-rate-limit";
import { ApiError } from "./errors.js";

export interface RateLimiter {
  consume(key: string, limit: number): Promise<{ allowed: boolean; totalHits: number; retryAfterSeconds: number }>;
}

export class RedisFixedWindowRateLimiter implements RateLimiter {
  private redis: Redis;
  private connection?: Promise<void>;

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl, {
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
  }

  async consume(key: string, limit: number) {
    if (this.redis.status === "wait" && !this.connection) {
      this.connection = this.redis.connect().finally(() => { this.connection = undefined; });
    }
    if (this.connection) await this.connection;
    const minute = Math.floor(Date.now() / 60000);
    const redisKey = "sj:rate:" + key + ":" + minute;
    const results = await this.redis.multi().incr(redisKey).expire(redisKey, 65).exec();
    if (!results || results.length !== 2 || results.some(([error]) => error)) {
      throw new Error("Redis rate-limit transaction failed.");
    }
    const count = Number(results[0][1]);
    if (!Number.isSafeInteger(count) || count < 1 || results[1][1] !== 1) {
      throw new Error("Redis rate-limit counter is invalid.");
    }
    return { allowed: count <= limit, totalHits: count, retryAfterSeconds: 60 - (Math.floor(Date.now() / 1000) % 60) };
  }

  async disconnect() {
    if (this.redis.status === "ready") {
      await this.redis.quit();
      return;
    }

    this.redis.disconnect(false);
  }
}

export class AllowAllRateLimiter implements RateLimiter {
  async consume() {
    return { allowed: true, totalHits: 1, retryAfterSeconds: 60 };
  }
}

export function rateLimitMiddleware({
  limiter,
  limit,
  key,
}: {
  limiter: RateLimiter;
  limit: number;
  key: (request: Parameters<RequestHandler>[0]) => string;
}): RequestHandler {
  return rateLimit({
    windowMs: 60_000,
    limit,
    keyGenerator: key,
    legacyHeaders: false,
    standardHeaders: false,
    passOnStoreError: false,
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
    store: {
      async increment(counterKey) {
        try {
          const result = await limiter.consume(counterKey, limit);
          if (!Number.isSafeInteger(result.totalHits) || result.totalHits < 1
            || result.allowed !== (result.totalHits <= limit)
            || !Number.isFinite(result.retryAfterSeconds) || result.retryAfterSeconds <= 0) {
            throw new Error("Invalid rate-limit result.");
          }
          return { totalHits: result.totalHits, resetTime: new Date(Date.now() + result.retryAfterSeconds * 1000) };
        } catch {
          throw new ApiError(503, "RATE_LIMIT_UNAVAILABLE", "Layanan perlindungan request sedang tidak tersedia.", { retryable: true });
        }
      },
      // Semua request dihitung; counter hanya berakhir melalui TTL Redis.
      decrement() { throw new Error("Rate-limit counters cannot be decremented."); },
      resetKey() { throw new Error("Rate-limit counters cannot be reset manually."); },
    },
    handler(request, _response, next) {
      const info = (request as typeof request & { rateLimit?: RateLimitInfo }).rateLimit;
      const resetTime = info?.resetTime?.getTime() || Date.now() + 60_000;
      next(new ApiError(429, "RATE_LIMITED", "Terlalu banyak permintaan. Silakan coba kembali.", {
        retryable: true,
        retryAfterSeconds: Math.max(1, Math.ceil((resetTime - Date.now()) / 1000)),
      }));
    },
  });
}
