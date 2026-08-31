import pino from "pino";
import { loadApiServerConfig, safeConfigSummary } from "@seputarjaminan/config/server";
import { createStorageAdapter } from "@seputarjaminan/storage";
import { createApp } from "./app.js";
import { createDatabaseClients } from "./database.js";
import { AllowAllRateLimiter, RedisFixedWindowRateLimiter } from "./rate-limit.js";

const config = loadApiServerConfig(process.env, {
  repositoryRoot: new URL("../../../", import.meta.url).pathname,
});
const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  base: { service: "seputarjaminan-api" },
  redact: {
    paths: [
      "databaseUrl",
      "*.databaseUrl",
      "*.password",
      "*.secret",
      "*.token",
      "*.signature",
      "*.phone_e164",
    ],
    censor: "[REDACTED]",
  },
});
const databases = createDatabaseClients(config as any);
const storage = createStorageAdapter(config.storage);
const ingestLimiter = config.redisUrl
  ? new RedisFixedWindowRateLimiter(config.redisUrl)
  : new AllowAllRateLimiter();
const publicLimiter = config.redisUrl
  ? new RedisFixedWindowRateLimiter(config.redisUrl)
  : new AllowAllRateLimiter();
const app = createApp({ config, databases, storage, ingestLimiter, publicLimiter, logger });

const server = app.listen(config.api.port, config.api.host, () => {
  logger.info({ config: safeConfigSummary(config) }, "api_started");
});

async function shutdown(signal: string) {
  logger.info({ signal }, "api_shutdown_started");
  server.close(async () => {
    await databases.disconnect();
    if (ingestLimiter instanceof RedisFixedWindowRateLimiter) await ingestLimiter.disconnect();
    if (publicLimiter instanceof RedisFixedWindowRateLimiter) await publicLimiter.disconnect();
    process.exit(0);
  });
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
