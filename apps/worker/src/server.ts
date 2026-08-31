import pino from "pino";
import { loadWorkerServerConfig, safeConfigSummary } from "@seputarjaminan/config/server";
import { createStorageAdapter } from "@seputarjaminan/storage";
import { createWorkerDatabase } from "./database.js";
import { createMalwareScanner } from "./malware-scanner.js";
import { CentralWorker } from "./worker.js";

const config = loadWorkerServerConfig(process.env, {
  repositoryRoot: new URL("../../../", import.meta.url).pathname,
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
await scanner.verifyReady();
const worker = new CentralWorker(
  database,
  storage,
  scanner,
  logger,
  config.security.mediaFileMaxBytes,
);
logger.info({ config: safeConfigSummary(config) }, "worker_started");

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    logger.info({ signal }, "worker_shutdown_requested");
    worker.stop();
  });
}

await worker.run();
await database.$disconnect();
