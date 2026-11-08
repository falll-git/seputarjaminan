import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import path from "node:path";
import net from "node:net";
import { scanWithClamAv } from "../apps/worker/src/clamav-command.mjs";
import { readProfile, readProfiles, repositoryRoot, childEnvironment, assertWebsiteEnvFiles, apiDatabaseKeys, fail } from "./local-environment.mjs";

const execute = promisify(execFile);
export async function checkRedis(environment) {
  const { default: Redis } = await import("ioredis");
  const redis = new Redis(environment.SJ_REDIS_URL, { lazyConnect: true, connectTimeout: 2500, maxRetriesPerRequest: 0, retryStrategy: () => null, enableOfflineQueue: false });
  redis.on("error", () => {});
  try { await redis.connect(); return await redis.ping() === "PONG"; }
  catch { return false; }
  finally { redis.disconnect(); }
}
export async function checkDatabase(value, expectedRole) {
  const { Client } = await import("pg");
  const client = new Client({ connectionString: value, connectionTimeoutMillis: 2500, query_timeout: 3000, options: "-c default_transaction_read_only=on -c statement_timeout=3000" });
  try {
    await client.connect();
    await client.query("BEGIN READ ONLY");
    const { rows: [role] } = await client.query("SELECT rolsuper, rolbypassrls, rolcreaterole, rolcreatedb FROM pg_roles WHERE rolname = current_user");
    const { rows } = await client.query("SELECT rolname FROM pg_roles WHERE rolname IN ('sj_registry','sj_ingest','sj_public','sj_ops','sj_worker') AND pg_has_role(current_user, oid, 'MEMBER') ORDER BY rolname");
    await client.query("ROLLBACK");
    // Owner is deliberately isolated from runtime. No owner mutation here.
    if (!expectedRole) return { connected: true, elevated: role.rolsuper || role.rolbypassrls, scope: "owner-only" };
    const safe = !role.rolsuper && !role.rolbypassrls && !role.rolcreaterole && !role.rolcreatedb && rows.length === 1 && rows[0].rolname === expectedRole;
    return { connected: true, safe, scope: expectedRole };
  } catch { return { connected: false, safe: false, scope: expectedRole || "owner-only" }; }
  finally { await client.end().catch(() => {}); }
}
export async function dependencyReport(profiles) {
  const databases = {};
  for (const [index, key] of apiDatabaseKeys.entries()) databases[key] = await checkDatabase(profiles.api[key], ["sj_registry", "sj_ingest", "sj_public", "sj_ops"][index]);
  databases.SJ_WORKER_DATABASE_URL = await checkDatabase(profiles.worker.SJ_WORKER_DATABASE_URL, "sj_worker");
  databases.DATABASE_URL = await checkDatabase(profiles.migration.DATABASE_URL);
  let scannerCleanScan = false;
  try {
    scannerCleanScan = await scanWithClamAv({ command: profiles.worker.SJ_CLAMDSCAN_COMMAND || "clamdscan", dockerContainer: profiles.worker.SJ_CLAMAV_DOCKER_CONTAINER }, Buffer.from("SJ local dependency readiness\n")) === "CLEAN";
  } catch { /* No output: a scanner error can include filesystem/config contents. */ }
  return { databases, redisPing: await checkRedis(profiles.api), scannerCleanScan, scannerInfectedTest: "NOT_RUN_BY_READINESS_CHECK", worker: "LOCKED_OFF", ingest: "LOCKED_OFF" };
}
export async function assertPortFree(host, port) {
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", () => reject(new Error("PORT_UNAVAILABLE_NO_DUPLICATE_START")));
    server.listen({ host, port, exclusive: true }, () => server.close(resolve));
  });
}
async function run() {
  const [command, ...args] = process.argv.slice(2);
  if (!["check", "website", "api", "worker", "migration-status"].includes(command) || args.some((arg) => arg !== "--dependencies") || (args.length && command !== "check") || args.length > 1) fail("INVALID_LOCAL_COMMAND");
  if (command === "check") {
    const profiles = readProfiles();
    assertWebsiteEnvFiles();
    console.log(JSON.stringify({ configuration: "PASS", profiles: Object.keys(profiles), activation: "LOCKED_OFF", secretValues: "NOT_PRINTED" }));
    if (args.includes("--dependencies")) {
      const report = await dependencyReport(profiles);
      console.log(JSON.stringify(report));
      if (!report.redisPing || !report.scannerCleanScan || Object.values(report.databases).some((entry) => !entry.connected || entry.safe === false)) process.exitCode = 2;
    }
    return;
  }
  const scope = command === "migration-status" ? "migration" : command;
  const profile = readProfile(scope);
  if (command === "worker") fail("OPS01_WORKER_START_LOCKED_UNTIL_ISOLATED_TARGET_APPROVED");
  const environment = childEnvironment(scope, profile);
  let executable;
  if (command === "website") {
    assertWebsiteEnvFiles();
    await assertPortFree("127.0.0.1", 4411);
    executable = [path.join(repositoryRoot, "node_modules/next/dist/bin/next"), "dev", "--hostname", "127.0.0.1", "--port", "4411"];
  } else if (command === "migration-status") {
    // Prisma reads root .env through dotenv/config. It too must not add other credentials.
    assertWebsiteEnvFiles();
    executable = [path.join(repositoryRoot, "node_modules/prisma/build/index.js"), "migrate", "status"];
    try {
      await execute(process.execPath, executable, { cwd: repositoryRoot, env: environment, timeout: 30000, windowsHide: true });
      console.log("MIGRATION_STATUS_PASS");
    } catch { fail("MIGRATION_STATUS_FAILED"); }
    return;
  } else {
    if (!await checkRedis(profile)) fail("REDIS_NOT_READY_API_NOT_STARTED");
    for (const [index, key] of apiDatabaseKeys.entries()) {
      if (!(await checkDatabase(profile[key], ["sj_registry", "sj_ingest", "sj_public", "sj_ops"][index])).safe) fail("DATABASE_SCOPE_NOT_READY_API_NOT_STARTED");
    }
    await assertPortFree(profile.SJ_API_HOST, Number(profile.SJ_API_PORT));
    executable = ["--import", "tsx", path.join(repositoryRoot, "apps/api/src/server.ts")];
  }
  const child = spawn(process.execPath, executable, { cwd: repositoryRoot, env: environment, stdio: "inherit", windowsHide: true });
  child.once("error", () => { console.error("LOCAL_CHILD_FAILED_TO_START"); process.exitCode = 1; });
  child.once("exit", (code) => { process.exitCode = code ?? 1; });
  for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => child.kill(signal));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run().catch((error) => {
    // Emit only our fixed diagnostic codes. Never serialize dependency/Zod errors.
    console.error(/^[A-Z0-9_]+$/.test(error.message) ? error.message : "LOCAL_CONFIG_CHECK_FAILED");
    process.exitCode = 1;
  });
}
