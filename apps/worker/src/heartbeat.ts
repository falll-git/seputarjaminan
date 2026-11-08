import Redis from "ioredis";
import { randomUUID } from "node:crypto";

type HeartbeatRedis = {
  status: string;
  connect(): Promise<unknown>;
  set(key: string, value: string, mode: "PX", ttlMs: number): Promise<unknown>;
  eval(script: string, numKeys: number, ...args: string[]): Promise<unknown>;
  on?(event: string, listener: () => void): unknown;
  quit(): Promise<unknown>;
  disconnect(): unknown;
};

export function createWorkerHeartbeat(input: { redisUrl: string; key: string; intervalMs: number; ttlMs: number }, options: {
  redis?: HeartbeatRedis;
  setIntervalFn?: typeof setInterval;
  clearIntervalFn?: typeof clearInterval;
  now?: () => Date;
  ready?: () => Promise<boolean>;
} = {}) {
  const redis = options.redis ?? new Redis(input.redisUrl, { lazyConnect: true, connectTimeout: 1000, maxRetriesPerRequest: 1, enableOfflineQueue: false });
  let timer: ReturnType<typeof setInterval> | undefined;
  const instanceId = randomUUID();
  const aliveKey = `${input.key}:alive:${instanceId}`;
  let lastValue = "";
  let pending: Promise<void> | undefined;
  let stopped = false;
  redis.on?.("error", () => undefined); // Readiness/TTL reports failure, never unhandled EventEmitter error.
  const removeOwned = async (key: string, value: string) => redis.eval(
    "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end return 0",
    1, key, value,
  );
  const beat = async () => {
    if (redis.status === "wait") await redis.connect();
    await redis.set(aliveKey, instanceId, "PX", input.ttlMs);
    if (!await options.ready?.() || stopped) {
      if (lastValue) await removeOwned(input.key, lastValue);
      return;
    }
    lastValue = JSON.stringify({ version: 1, instance_id: instanceId, observed_at: (options.now?.() ?? new Date()).toISOString(), status: "PROCESSING_CAPABLE" });
    await redis.set(input.key, lastValue, "PX", input.ttlMs);
  };
  return {
    async start() {
      if (timer || stopped) throw new Error("HEARTBEAT_ALREADY_STARTED_OR_STOPPED");
      // Redis outage degrades visibility but does not falsely stop DB-backed processing.
      await beat().catch(() => undefined);
      timer = (options.setIntervalFn ?? setInterval)(() => {
        if (pending || stopped) return;
        pending = beat().catch(() => undefined).finally(() => { pending = undefined; });
      }, input.intervalMs);
      timer.unref?.();
    },
    async stop() {
      stopped = true;
      if (timer) (options.clearIntervalFn ?? clearInterval)(timer);
      await pending;
      try { if (lastValue) await removeOwned(input.key, lastValue); await removeOwned(aliveKey, instanceId); await redis.quit(); }
      catch { redis.disconnect(); }
    },
  };
}
