import type { RequestHandler } from "express";
import Redis from "ioredis";
import { ApiError } from "./errors.js";

export interface RateLimiter {
  consume(key: string, limit: number): Promise<{ allowed: boolean; retryAfterSeconds: number }>;
}

export class RedisFixedWindowRateLimiter implements RateLimiter {
  private redis: Redis;

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl, {
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
  }

  async consume(key: string, limit: number) {
    if (this.redis.status === "wait") await this.redis.connect();
    const minute = Math.floor(Date.now() / 60000);
    const redisKey = "sj:rate:" + key + ":" + minute;
    const results = await this.redis.multi().incr(redisKey).expire(redisKey, 65).exec();
    const count = Number(results?.[0]?.[1] || 0);
    return { allowed: count <= limit, retryAfterSeconds: 60 - (Math.floor(Date.now() / 1000) % 60) };
  }

  async disconnect() {
    await this.redis.quit();
  }
}

export class AllowAllRateLimiter implements RateLimiter {
  async consume() {
    return { allowed: true, retryAfterSeconds: 0 };
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
  return async (request, _response, next) => {
    try {
      const result = await limiter.consume(key(request), limit);
      if (!result.allowed) {
        throw new ApiError(429, "RATE_LIMITED", "Terlalu banyak permintaan. Silakan coba kembali.", {
          retryable: true,
          retryAfterSeconds: result.retryAfterSeconds,
        });
      }
      next();
    } catch (error) {
      if (error instanceof ApiError) return next(error);
      next(new ApiError(503, "RATE_LIMIT_UNAVAILABLE", "Layanan perlindungan request sedang tidak tersedia.", {
        retryable: true,
      }));
    }
  };
}
