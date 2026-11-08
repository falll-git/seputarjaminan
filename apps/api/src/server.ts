import pino from "pino";
import { fileURLToPath } from "node:url";
import { loadApiServerConfig, safeConfigSummary } from "@seputarjaminan/config/server";
import { createStorageAdapter } from "@seputarjaminan/storage";
import { createApp } from "./app.js";
import { createDatabaseClients } from "./database.js";
import { AllowAllRateLimiter, RedisFixedWindowRateLimiter } from "./rate-limit.js";
import { RedisMonitoringRuntime } from "./monitoring-runtime.js";
import { createShutdown } from "./shutdown.js";

const config = loadApiServerConfig(process.env, {
  repositoryRoot: fileURLToPath(new URL("../../../", import.meta.url)),
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
const monitoringRuntime = config.redisUrl ? new RedisMonitoringRuntime(config.redisUrl) : undefined;
const app = createApp({ config, databases, storage, ingestLimiter, publicLimiter, monitoringRuntime, logger });

const server = app.listen(config.api.port, config.api.host, () => {
  logger.info({ config: safeConfigSummary(config) }, "api_started");
});

const stop = createShutdown({server, cleanup: [
  () => databases.disconnect(),
  async () => { if (ingestLimiter instanceof RedisFixedWindowRateLimiter) await ingestLimiter.disconnect(); },
  async () => { if (publicLimiter instanceof RedisFixedWindowRateLimiter) await publicLimiter.disconnect(); },
  async () => { if (monitoringRuntime) await monitoringRuntime.disconnect(); },
], exit: code => process.exit(code), onError: () => logger.error("api_shutdown_incomplete")});

async function shutdown(signal: string) {
  logger.info({ signal }, "api_shutdown_started");
  await stop();
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
