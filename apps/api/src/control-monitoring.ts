import { createHash, randomUUID, sign, verify } from "node:crypto";
import type { RequestHandler } from "express";
import type { DatabaseClients } from "./database.js";
import { ApiError } from "./errors.js";
import type { MonitoringRuntime } from "./monitoring-runtime.js";

export const CONTROL_MONITORING_PATH = "/v1/internal/ruwang-control/sj-monitoring/snapshot";
const EMPTY_DIGEST = createHash("sha256").update(Buffer.alloc(0)).digest("hex");
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function workerHeartbeatHealthy(value: string | null, now: Date): boolean {
  try {
    const beat = JSON.parse(value ?? "null");
    const age = now.getTime() - Date.parse(beat?.observed_at);
    return beat?.version === 1 && beat.status === "PROCESSING_CAPABLE"
      && typeof beat.instance_id === "string" && UUID_PATTERN.test(beat.instance_id)
      && Number.isFinite(age) && age >= 0 && age <= 30000;
  } catch { return false; }
}

const headers = Object.freeze({
  instanceId: "x-rc-instance-id",
  keyId: "x-rc-key-id",
  timestamp: "x-rc-timestamp",
  nonce: "x-rc-nonce",
  digest: "x-rc-content-sha256",
  signature: "x-rc-signature",
  responseKeyId: "x-rc-ack-key-id",
  responseTimestamp: "x-rc-ack-timestamp",
  responseNonce: "x-rc-ack-nonce",
  responseDigest: "x-rc-ack-content-sha256",
  responseSignature: "x-rc-ack-signature",
});

function canonical(value: unknown): string {
  const normalize = (item: unknown): unknown => {
    if (item === null || typeof item === "string" || typeof item === "boolean") return item;
    if (typeof item === "number") {
      if (!Number.isFinite(item)) throw new TypeError("Canonical JSON menolak angka non-finite.");
      return item;
    }
    if (Array.isArray(item)) return item.map(normalize);
    if (typeof item === "object") {
      const result: Record<string, unknown> = {};
      for (const key of Object.keys(item as Record<string, unknown>).sort()) {
        const child = (item as Record<string, unknown>)[key];
        if (child === undefined || typeof child === "function" || typeof child === "symbol") {
          throw new TypeError("Canonical JSON menolak nilai yang tidak dapat diserialisasi.");
        }
        result[key] = normalize(child);
      }
      return result;
    }
    throw new TypeError("Canonical JSON hanya menerima nilai JSON.");
  };
  return JSON.stringify(normalize(value));
}

function signingMessage(input: { method: string; path: string; timestamp: string; nonce: string; digest: string }) {
  return ["RUWANG-CONTROL-V1", input.method.toUpperCase(), input.path, input.timestamp, input.nonce, input.digest].join("\n");
}

function digest(value: unknown) {
  return createHash("sha256").update(canonical(value)).digest("hex");
}

function verifySignature(message: string, signature: string, publicKey: string) {
  try { return verify(null, Buffer.from(message), publicKey, Buffer.from(signature, "base64url")); }
  catch { return false; }
}

function safeFrontendUrl(value: URL, production: boolean) {
  const loopback = value.hostname === "127.0.0.1" || value.hostname === "localhost";
  return !value.username && !value.password && !value.search && !value.hash
    && (production ? value.protocol === "https:" : value.protocol === "https:" || loopback && value.protocol === "http:");
}

async function probeFrontend(url: URL, timeoutMs: number, fetcher: typeof fetch) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(url, { method: "GET", redirect: "error", signal: controller.signal, headers: { accept: "text/html" } });
    return response.ok
      ? { key: "frontend", status: "healthy" as const }
      : { key: "frontend", status: "degraded" as const, detail_code: "FRONTEND_HTTP_ERROR" };
  } catch {
    return { key: "frontend", status: "degraded" as const, detail_code: "FRONTEND_UNREACHABLE" };
  } finally { clearTimeout(timeout); }
}

type MonitoringConfig = {
  nodeEnv: string;
  redisUrl?: string;
  flags: { controlMonitoring?: boolean };
  controlMonitoring?: {
    instanceId?: string; keyId?: string; publicKey?: string; responseKeyId?: string;
    responsePrivateKey?: string; audience?: string; frontendUrl?: string;
    probeTimeoutMs?: number; workerHeartbeatKey?: string;
  };
  security: { nonceTtlSeconds: number; signatureToleranceSeconds: number };
};

export function createControlMonitoringHandler(input: {
  config: MonitoringConfig;
  databases: DatabaseClients;
  runtime?: MonitoringRuntime;
  fetcher?: typeof fetch;
  now?: () => Date;
}): RequestHandler {
  return async (request, response, next) => {
    try {
      const settings = input.config.controlMonitoring;
      if (!input.config.flags.controlMonitoring) throw new ApiError(503, "CONTROL_MONITORING_DISABLED", "Monitoring Control belum diaktifkan.");
      if (!settings || !input.runtime || !settings.instanceId || !settings.keyId || !settings.publicKey || !settings.responseKeyId
          || !settings.responsePrivateKey || !settings.audience || !settings.frontendUrl || !settings.probeTimeoutMs || !settings.workerHeartbeatKey) {
        throw new ApiError(503, "CONTROL_MONITORING_NOT_CONFIGURED", "Monitoring Control belum dikonfigurasi.");
      }
      const now = input.now?.() ?? new Date();
      const timestamp = request.get(headers.timestamp) ?? "";
      const nonce = request.get(headers.nonce) ?? "";
      const requestTime = Date.parse(timestamp);
      const signature = request.get(headers.signature) ?? "";
      const requestDigest = request.get(headers.digest) ?? "";
      const message = signingMessage({ method: "GET", path: CONTROL_MONITORING_PATH, timestamp, nonce, digest: requestDigest });
      if (request.get(headers.instanceId) !== settings.instanceId || request.get(headers.keyId) !== settings.keyId
          || request.get("x-rc-audience") !== settings.audience || !UUID_PATTERN.test(nonce) || requestDigest !== EMPTY_DIGEST
          || !Number.isFinite(requestTime) || Math.abs(now.getTime() - requestTime) > input.config.security.signatureToleranceSeconds * 1_000
          || !verifySignature(message, signature, settings.publicKey)) {
        throw new ApiError(401, "CONTROL_MONITORING_REJECTED", "Koneksi monitoring Control ditolak.");
      }
      const nonceKey = `sj:control-monitor:${settings.instanceId}:${settings.keyId}:${nonce}`;
      if (!await input.runtime.reserveNonce(nonceKey, input.config.security.nonceTtlSeconds)) {
        throw new ApiError(409, "CONTROL_MONITORING_REPLAYED", "Request monitoring sudah pernah diterima.");
      }
      const frontendUrl = new URL(settings.frontendUrl);
      if (!safeFrontendUrl(frontendUrl, input.config.nodeEnv === "production")) {
        throw new ApiError(503, "CONTROL_MONITORING_FRONTEND_INVALID", "Target frontend monitoring tidak aman.");
      }

      const [frontend, databaseReady, heartbeat, queueRows] = await Promise.all([
        probeFrontend(frontendUrl, settings.probeTimeoutMs, input.fetcher ?? fetch),
        input.databases.registry.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
        input.runtime.readWorkerHeartbeat(settings.workerHeartbeatKey).catch(() => null),
        input.databases.ops.centralJob.groupBy({ by: ["state"], _count: { _all: true } }).catch(() => null),
      ]);
      // The heartbeat can advance while asynchronous probes run. Compare it
      // with observation completion, not the earlier request-authentication time.
      const observedNow = input.now?.() ?? new Date();
      const workerHealthy = workerHeartbeatHealthy(heartbeat, observedNow);
      const count = (states: string[]) => queueRows?.filter((row: any) => states.includes(row.state))
        .reduce((sum: number, row: any) => sum + row._count._all, 0) ?? 0;
      const queueUnavailable = queueRows === null;
      const pending = count(["PENDING", "RETRY_WAIT", "PROCESSING"]);
      const failed = count(["DEAD_LETTER"]);
      const snapshot = {
        contract_version: 1,
        instance_id: settings.instanceId,
        source_kind: "sj_central",
        observed_at: observedNow.toISOString(),
        services: [
          frontend,
          { key: "api", status: "healthy" as const },
          databaseReady ? { key: "readiness", status: "healthy" as const } : { key: "readiness", status: "degraded" as const, detail_code: "DATABASE_UNAVAILABLE" },
          workerHealthy ? { key: "worker", status: "healthy" as const } : { key: "worker", status: "degraded" as const, detail_code: "WORKER_HEARTBEAT_MISSING" },
          queueUnavailable ? { key: "pipeline", status: "unknown" as const, detail_code: "QUEUE_STATUS_UNAVAILABLE" }
            : failed > 0 ? { key: "pipeline", status: "degraded" as const, detail_code: "DEAD_LETTER_PRESENT" }
            : { key: "pipeline", status: "healthy" as const },
        ],
        queues: [queueUnavailable
          ? { key: "central_jobs", status: "unknown" as const, detail_code: "QUEUE_STATUS_UNAVAILABLE" }
          : { key: "central_jobs", status: failed > 0 ? "degraded" as const : "healthy" as const, depth: pending,
              ...(failed > 0 ? { detail_code: "DEAD_LETTER_PRESENT" } : {}) }],
      };
      const body = canonical(snapshot);
      const responseDigest = digest(snapshot);
      const responseTimestamp = (input.now?.() ?? new Date()).toISOString();
      const responseNonce = randomUUID();
      const responseMessage = signingMessage({ method: "GET", path: CONTROL_MONITORING_PATH, timestamp: responseTimestamp, nonce: responseNonce, digest: responseDigest });
      const responseSignature = sign(null, Buffer.from(responseMessage), settings.responsePrivateKey).toString("base64url");
      response.set({
        "content-type": "application/json",
        "cache-control": "no-store",
        [headers.responseKeyId]: settings.responseKeyId,
        [headers.responseTimestamp]: responseTimestamp,
        [headers.responseNonce]: responseNonce,
        [headers.responseDigest]: responseDigest,
        [headers.responseSignature]: responseSignature,
      });
      response.status(200).send(body);
    } catch (error) { next(error); }
  };
}
