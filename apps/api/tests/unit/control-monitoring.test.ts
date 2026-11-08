import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, randomUUID, sign, verify } from "node:crypto";
import test from "node:test";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { CONTROL_MONITORING_PATH, workerHeartbeatHealthy } from "../../src/control-monitoring.js";
import { AllowAllRateLimiter } from "../../src/rate-limit.js";

function canonical(value: unknown): string {
  const normalize = (item: unknown): unknown => {
    if (item === null || typeof item === "string" || typeof item === "boolean" || typeof item === "number") return item;
    if (Array.isArray(item)) return item.map(normalize);
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(item as Record<string, unknown>).sort()) result[key] = normalize((item as Record<string, unknown>)[key]);
    return result;
  };
  return JSON.stringify(normalize(value));
}

function message(timestamp: string, nonce: string, digest: string) {
  return ["RUWANG-CONTROL-V1", "GET", CONTROL_MONITORING_PATH, timestamp, nonce, digest].join("\n");
}

const controlKeys = generateKeyPairSync("ed25519");
const responseKeys = generateKeyPairSync("ed25519");
const instanceId = randomUUID();
const emptyDigest = createHash("sha256").update(Buffer.alloc(0)).digest("hex");
const observedAt = new Date();

test("worker health rejects liveness-only, future, stale or malformed heartbeats", () => {
  const base={version:1,instance_id:randomUUID(),status:'PROCESSING_CAPABLE',observed_at:observedAt.toISOString()};
  assert.equal(workerHeartbeatHealthy(JSON.stringify(base),observedAt),true);
  for(const value of [null,'invalid',observedAt.toISOString(),JSON.stringify({...base,status:'ALIVE'}),JSON.stringify({...base,observed_at:new Date(observedAt.getTime()-31000).toISOString()}),JSON.stringify({...base,observed_at:new Date(observedAt.getTime()+1000).toISOString()})]){
    assert.equal(workerHeartbeatHealthy(value,observedAt),false);
  }
});

function fixture(enabled = true, refreshedDuringRead = false) {
  const used = new Set<string>();
  const runtime = {
    async reserveNonce(key: string) { if (used.has(key)) return false; used.add(key); return true; },
    async readWorkerHeartbeat() {
      if (refreshedDuringRead) await new Promise(resolve => setTimeout(resolve, 30));
      return JSON.stringify({version:1,instance_id:randomUUID(),status:'PROCESSING_CAPABLE',observed_at:(refreshedDuringRead ? new Date() : observedAt).toISOString()});
    },
    async disconnect() {},
  };
  const databases = {
    registry: { $queryRaw: async () => [{ value: 1 }] },
    ingest: {}, publicRead: {},
    ops: { centralJob: { groupBy: async () => [{ state: "PENDING", _count: { _all: 2 } }] } },
  } as any;
  const config = {
    nodeEnv: "test",
    flags: { ingest: false, mediaUpload: false, publicSite: false, controlMonitoring: enabled },
    security: { eventBodyMaxBytes: 262144, mediaFileMaxBytes: 10485760, mediaTotalMaxBytes: 52428800, signatureToleranceSeconds: 300, nonceTtlSeconds: 600 },
    rateLimit: {}, uploadSessionTtlSeconds: 300,
    publicMediaBaseUrl: "http://127.0.0.1:4100/v1/public/media",
    publicApiBaseUrl: "http://127.0.0.1:4100",
    storage: { provider: "FILESYSTEM" },
    controlMonitoring: {
      instanceId, keyId: "control-monitor-key", publicKey: controlKeys.publicKey.export({ type: "spki", format: "pem" }).toString(),
      responseKeyId: "central-response-key", responsePrivateKey: responseKeys.privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
      audience: "ruwang-control-local", frontendUrl: "http://127.0.0.1:4310", probeTimeoutMs: 500,
      workerHeartbeatKey: "seputarjaminan:worker-heartbeat:central",
    },
  };
  const app = createApp({ config, databases, storage: {}, ingestLimiter: new AllowAllRateLimiter(), publicLimiter: new AllowAllRateLimiter(),
    monitoringRuntime: runtime, monitoringFetcher: async () => new Response("<html></html>", { status: 200 }), logger: undefined });
  return { app };
}

function signedHeaders(nonce = randomUUID(), timestamp = observedAt.toISOString()) {
  const signature = sign(null, Buffer.from(message(timestamp, nonce, emptyDigest)), controlKeys.privateKey).toString("base64url");
  return { nonce, values: {
    "x-rc-instance-id": instanceId, "x-rc-key-id": "control-monitor-key", "x-rc-timestamp": timestamp,
    "x-rc-nonce": nonce, "x-rc-content-sha256": emptyDigest, "x-rc-signature": signature,
    "x-rc-audience": "ruwang-control-local",
  } };
}

test("snapshot pusat hanya menerima request bertanda tangan dan menandatangani respons minimal", async () => {
  const { app } = fixture();
  const signed = signedHeaders();
  let call = request(app).get(CONTROL_MONITORING_PATH);
  for (const [key, value] of Object.entries(signed.values)) call = call.set(key, value);
  const response = await call.expect(200);
  const bodyText = response.text;
  assert.equal(bodyText, canonical(JSON.parse(bodyText)));
  const body = JSON.parse(bodyText);
  assert.equal(body.instance_id, instanceId);
  assert.equal(body.source_kind, "sj_central");
  assert.deepEqual(body.queues, [{ key: "central_jobs", status: "healthy", depth: 2 }]);
  assert.equal(body.uptime, undefined);
  assert.equal(body.environment, undefined);
  const responseDigest = createHash("sha256").update(bodyText).digest("hex");
  assert.equal(response.headers["x-rc-ack-content-sha256"], responseDigest);
  assert.equal(verify(null, Buffer.from(message(response.headers["x-rc-ack-timestamp"], response.headers["x-rc-ack-nonce"], responseDigest)),
    responseKeys.publicKey, Buffer.from(response.headers["x-rc-ack-signature"], "base64url")), true);

  let replay = request(app).get(CONTROL_MONITORING_PATH);
  for (const [key, value] of Object.entries(signed.values)) replay = replay.set(key, value);
  assert.equal((await replay.expect(409)).body.code, "CONTROL_MONITORING_REPLAYED");
});

test("snapshot pusat menolak request tanpa signature", async () => {
  const { app } = fixture();
  assert.equal((await request(app).get(CONTROL_MONITORING_PATH).expect(401)).body.code, "CONTROL_MONITORING_REJECTED");
});

test("heartbeat refreshed while probes run is not misclassified as future", async () => {
  const { app } = fixture(true, true);
  const response = await request(app).get(CONTROL_MONITORING_PATH).set(signedHeaders().values).expect(200);
  assert.equal(response.body.services.find((service: { key: string }) => service.key === "worker").status, "healthy");
});

test("snapshot pusat tetap tertutup ketika feature flag mati", async () => {
  const { app } = fixture(false);
  assert.equal((await request(app).get(CONTROL_MONITORING_PATH).expect(503)).body.code, "CONTROL_MONITORING_DISABLED");
});
