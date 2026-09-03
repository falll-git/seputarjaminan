import assert from "node:assert/strict";
import { generateKeyPairSync, randomUUID } from "node:crypto";
import test from "node:test";
import express from "express";
import request from "supertest";
import { createContentSha256, createSigningMessage, INTEGRATION_HEADERS, signIntegrationMessage } from "@seputarjaminan/contracts";
import { Prisma } from "../../../../generated/prisma/client.ts";
import { createIntegrationAuthentication } from "../../src/authentication.js";
import { errorHandler, requestContext } from "../../src/errors.js";
import { AllowAllRateLimiter, rateLimitMiddleware } from "../../src/rate-limit.js";

function fixture() {
  const pair = generateKeyPairSync("ed25519");
  const institutionId = randomUUID();
  const keyId = randomUUID();
  const now = new Date("2026-09-01T12:00:00.000Z");
  const key = {
    institutionId, keyId, installationId: randomUUID(), state: "ACTIVE", algorithm: "ED25519",
    validFrom: new Date(now.getTime() - 60_000), validUntil: null,
    publicKey: pair.publicKey.export({ type: "spki", format: "pem" }).toString(),
    installation: { state: "ACTIVE", institution: { state: "ACTIVE" } },
  };
  const calls = { lookups: 0, nonces: 0, accepted: 0 };
  const seen = new Set<string>();
  const transaction = {
    $executeRaw: async () => 1,
    institutionKey: { findUnique: async () => { calls.lookups += 1; return key; } },
    requestNonce: { create: async ({ data }: any) => {
      calls.nonces += 1;
      if (seen.has(data.nonceHash)) throw new Prisma.PrismaClientKnownRequestError("Duplicate nonce", { code: "P2002", clientVersion: "7" });
      seen.add(data.nonceHash);
    } },
  };
  const database = { $transaction: async (handler: any) => handler(transaction) };
  const app = express();
  app.use(requestContext);
  app.use(rateLimitMiddleware({ limiter: new AllowAllRateLimiter(), limit: 600, key: () => "authentication-test" }));
  app.use(express.json({ verify(req, _res, buffer) { (req as express.Request).rawBody = Buffer.from(buffer); } }));
  app.post("/signed", createIntegrationAuthentication({ databases: { registry: database, ingest: database } as any, toleranceSeconds: 300, nonceTtlSeconds: 600, now: () => now }), (_req, res) => {
    calls.accepted += 1;
    res.sendStatus(204);
  });
  app.use(errorHandler);
  function send(options: { nonce?: string; timestamp?: string; route?: string; wrongKey?: boolean; badDigest?: boolean; missingSignature?: boolean } = {}) {
    const body = JSON.stringify({ value: "synthetic" });
    const nonce = options.nonce ?? randomUUID();
    const timestamp = options.timestamp ?? now.toISOString();
    const digest = options.badDigest ? "a".repeat(64) : createContentSha256(body);
    const message = createSigningMessage({ method: "POST", path: "/signed", timestamp, nonce, contentSha256: digest });
    const call = request(app).post(options.route ?? "/signed").set("Content-Type", "application/json")
      .set(INTEGRATION_HEADERS.institutionId, institutionId).set(INTEGRATION_HEADERS.keyId, keyId)
      .set(INTEGRATION_HEADERS.timestamp, timestamp).set(INTEGRATION_HEADERS.nonce, nonce)
      .set(INTEGRATION_HEADERS.contentSha256, digest);
    if (!options.missingSignature) call.set(INTEGRATION_HEADERS.signature, signIntegrationMessage(message, options.wrongKey ? generateKeyPairSync("ed25519").privateKey : pair.privateKey));
    return call.send(body);
  }
  return { send, calls, key };
}

test("metadata tidak valid berhenti sebelum lookup kunci dan tidak dapat melewati autentikasi", async () => {
  for (const [options, status, code] of [
    [{ nonce: "x".repeat(15) }, 401, "SIGNATURE_INVALID"],
    [{ nonce: "x".repeat(201) }, 401, "SIGNATURE_INVALID"],
    [{ timestamp: "invalidZ" }, 401, "SIGNATURE_INVALID"],
    [{ timestamp: "2026-09-01T12:00:00+00:00" }, 401, "SIGNATURE_INVALID"],
    [{ timestamp: "2026-09-01T11:54:59.000Z" }, 401, "SIGNATURE_EXPIRED"],
    [{ timestamp: "2026-09-01T12:05:01.000Z" }, 401, "SIGNATURE_EXPIRED"],
    [{ route: "/signed?skipVerification=true" }, 400, "SIGNED_QUERY_FORBIDDEN"],
    [{ badDigest: true }, 401, "SIGNATURE_INVALID"],
    [{ missingSignature: true }, 401, "SIGNATURE_REQUIRED"],
  ] as const) {
    const f = fixture();
    const response = await f.send(options).expect(status);
    assert.equal(response.body.code, code);
    assert.deepEqual(f.calls, { lookups: 0, nonces: 0, accepted: 0 });
  }
});

test("metadata valid tetap memerlukan signature sah dan kunci aktif", async () => {
  const wrong = fixture();
  assert.equal((await wrong.send({ wrongKey: true }).expect(401)).body.code, "SIGNATURE_INVALID");
  assert.deepEqual(wrong.calls, { lookups: 1, nonces: 0, accepted: 0 });
  const revoked = fixture();
  revoked.key.state = "REVOKED";
  await revoked.send().expect(401);
  assert.equal(revoked.calls.accepted, 0);
});

test("signature sah menerima nonce batas panjang, sedangkan replay tetap ditolak", async () => {
  for (const length of [16, 200]) {
    const f = fixture();
    const nonce = "n".repeat(length);
    await f.send({ nonce }).expect(204);
    const replay = await f.send({ nonce }).expect(409);
    assert.equal(replay.body.code, "REPLAY_REJECTED");
    assert.equal(f.calls.accepted, 1);
  }
});
