import Redis from "ioredis";

export interface MonitoringRuntime {
  reserveNonce(key: string, ttlSeconds: number): Promise<boolean>;
  readWorkerHeartbeat(key: string): Promise<string | null>;
  disconnect(): Promise<void>;
}

export class RedisMonitoringRuntime implements MonitoringRuntime {
  private readonly redis: Redis;
  private connection?: Promise<void>;

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl, {
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      connectTimeout: 1_000,
    });
    this.redis.on("error", () => undefined); // Probe failure remains unknown, not unhandled/noisy.
  }

  private async ready() {
    if (this.redis.status === "wait" && !this.connection) {
      this.connection = this.redis.connect().finally(() => { this.connection = undefined; });
    }
    if (this.connection) await this.connection;
  }

  async reserveNonce(key: string, ttlSeconds: number) {
    await this.ready();
    return await this.redis.set(key, "1", "EX", ttlSeconds, "NX") === "OK";
  }

  async readWorkerHeartbeat(key: string) {
    await this.ready();
    return this.redis.get(key);
  }

  async disconnect() {
    if (this.redis.status === "ready") await this.redis.quit();
    else this.redis.disconnect(false);
  }
}
