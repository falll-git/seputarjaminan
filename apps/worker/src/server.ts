import pino from "pino";
import { fileURLToPath } from "node:url";
import { loadWorkerServerConfig, safeConfigSummary } from "@seputarjaminan/config/server";
import { createStorageAdapter } from "@seputarjaminan/storage";
import { createWorkerDatabase } from "./database.js";
import { createMalwareScanner } from "./malware-scanner.js";
import { CentralWorker } from "./worker.js";
import { createWorkerHeartbeat } from "./heartbeat.js";

const config = loadWorkerServerConfig(process.env, {
  repositoryRoot: fileURLToPath(new URL("../../../", import.meta.url)),
});
if (!config.flags.worker) {
  throw new Error("Worker belum diaktifkan oleh SJ_WORKER_ENABLED.");
}
const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  base: { service: "seputarjaminan-worker" },
  redact: { paths: ["*.password", "*.secret", "*.token", "*.signature"], censor: "[REDACTED]" },
});
const database = createWorkerDatabase(config.workerDatabaseUrl);
const storage = createStorageAdapter(config.storage);
const scanner = createMalwareScanner(config.malware);
const worker = new CentralWorker(
  database,
  storage,
  scanner,
  logger,
  config.security.mediaFileMaxBytes,
);
if (!config.redisUrl) throw new Error("SJ_REDIS_URL wajib untuk heartbeat worker.");
let scannerCheckedAt = 0;
const heartbeat = createWorkerHeartbeat({ redisUrl: config.redisUrl, ...config.heartbeat }, {
  ready: async () => {
    const progress = worker.progress();
    if (progress.stopping || Date.now() - progress.lastProgressAt > 180000) return false;
    if (Date.now() - scannerCheckedAt > 30000) {
      await scanner.verifyReady();
      scannerCheckedAt = Date.now();
    }
    return true;
  },
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    logger.info({ signal }, "worker_shutdown_requested");
    worker.stop();
    // Give the bounded scanner/current job time to settle. A wedged dependency
    // must not keep a shutdown process alive indefinitely; the lease recovers it.
    setTimeout(() => {
      logger.error("worker_shutdown_deadline");
      process.exit(1);
    }, 150000).unref();
  });
}

try {
  await scanner.verifyReady();
  scannerCheckedAt = Date.now();
  await heartbeat.start();
  logger.info({ config: safeConfigSummary(config) }, "worker_started");
  await worker.run();
} finally {
  await heartbeat.stop();
  await database.$disconnect();
}
