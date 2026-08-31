import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import test from "node:test";
import pg from "pg";
import request from "supertest";
import { AllowAllRateLimiter } from "../../src/rate-limit.js";
import { createApp } from "../../src/app.js";
import { createDatabaseClients } from "../../src/database.js";
import { encryptSecret, totpCode } from "../../src/ops-crypto.js";
import { hashOpsSecret } from "../../src/ops-auth.js";

const { Client } = pg;
const ownerUrl = process.env.SJ_TEST_OWNER_DATABASE_URL;
const opsUrl = process.env.SJ_TEST_OPS_DATABASE_URL;
const opsUserId = "c1000000-0000-4000-8000-000000000003";
const keyId = "c2000000-0000-4000-8000-000000000004";
const mediaId = "c3000000-0000-4000-8000-000000000005";
const email = "ops.integration@example.invalid";
const password = "test-only-ops-password-strong";
const totpSecret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
const encryptionKey = Buffer.alloc(32, 23).toString("base64");
const sessionSecret = "integration-only-session-secret-at-least-32-chars";

test("ops login wajib MFA+CSRF dan onboarding tercatat tanpa private key", {
  skip: !ownerUrl || !opsUrl,
}, async (context) => {
  const owner = new Client({ connectionString: ownerUrl! });
  await owner.connect();
  const databases = createDatabaseClients({
    registryDatabaseUrl: opsUrl!,
    ingestDatabaseUrl: opsUrl!,
    publicDatabaseUrl: opsUrl!,
    opsDatabaseUrl: opsUrl!,
  });
  context.after(async () => {
    await owner.query("DELETE FROM quarantine_records WHERE subject_id = $1", [mediaId]);
    await owner.query("DELETE FROM media_objects WHERE id = $1", [mediaId]);
    await owner.query("DELETE FROM institution_keys WHERE key_id = $1", [keyId]);
    await owner.query("DELETE FROM institution_installations WHERE installation_name = 'Instalasi Ops Sintetis'");
    await owner.query("DELETE FROM institutions WHERE public_slug = 'bprs-ops-sintetis'");
    await owner.query("DELETE FROM ops_audit_logs WHERE ops_user_id = $1", [opsUserId]);
    await owner.query("DELETE FROM ops_users WHERE id = $1", [opsUserId]);
    await databases.disconnect();
    await owner.end();
  });

  await owner.query("DELETE FROM ops_audit_logs WHERE ops_user_id = $1", [opsUserId]);
  await owner.query("DELETE FROM ops_users WHERE id = $1", [opsUserId]);
  await owner.query(
    `INSERT INTO ops_users (id, email_normalized, display_name, password_hash, state, created_at, updated_at)
     VALUES ($1, $2, 'Operator Sintetis', $3, 'ACTIVE', now(), now())`,
    [opsUserId, email, await hashOpsSecret(password)],
  );
  await owner.query(
    `INSERT INTO ops_mfa_factors (id, ops_user_id, encrypted_secret, verified_at, created_at)
     VALUES (gen_random_uuid(), $1, $2, now(), now())`,
    [opsUserId, encryptSecret(totpSecret, encryptionKey)],
  );

  const config = {
    nodeEnv: "test",
    security: {
      eventBodyMaxBytes: 262_144,
      signatureToleranceSeconds: 300,
      nonceTtlSeconds: 600,
      mediaFileMaxBytes: 10_485_760,
      opsEncryptionKeyBase64: encryptionKey,
      opsSessionSecret: sessionSecret,
    },
    rateLimit: { ingestPerMinute: 60, publicPerMinute: 600, opsAuthPerMinute: 10 },
    flags: { ingest: false, mediaUpload: false, publicSite: false },
    publicMediaBaseUrl: "http://127.0.0.1:4100/v1/public/media",
  };
  const storage = { read: async () => { throw new Error("not used"); } };
  const app = createApp({
    config,
    databases,
    storage,
    ingestLimiter: new AllowAllRateLimiter(),
    publicLimiter: new AllowAllRateLimiter(),
  });

  const passwordStep = await request(app).post("/v1/ops/auth/login").send({ email, password });
  assert.equal(passwordStep.status, 200);
  assert.equal(typeof passwordStep.body.challenge_token, "string");

  const mfaStep = await request(app).post("/v1/ops/auth/mfa").send({
    challenge_token: passwordStep.body.challenge_token,
    code: totpCode(totpSecret),
  });
  assert.equal(mfaStep.status, 200);
  assert.equal(typeof mfaStep.body.csrf_token, "string");
  const cookie = mfaStep.headers["set-cookie"]?.[0];
  assert.match(cookie, /HttpOnly/u);
  assert.match(cookie, /SameSite=Strict/u);

  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const publicPem = publicKey.export({ type: "spki", format: "pem" }).toString();
  const privatePem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  const withoutCsrf = await request(app).post("/v1/ops/institutions").set("Cookie", cookie).send({});
  assert.equal(withoutCsrf.status, 403);

  const privateKeyAttempt = await request(app)
    .post("/v1/ops/institutions")
    .set("Cookie", cookie)
    .set("X-CSRF-Token", mfaStep.body.csrf_token)
    .send({
      legal_name_internal: "BPRS Ops Sintetis",
      public_slug: "bprs-ops-sintetis",
      installation_name: "Instalasi Ops Sintetis",
      public_key: privatePem,
      key_id: keyId,
    });
  assert.equal(privateKeyAttempt.status, 422);

  const onboarded = await request(app)
    .post("/v1/ops/institutions")
    .set("Cookie", cookie)
    .set("X-CSRF-Token", mfaStep.body.csrf_token)
    .send({
      legal_name_internal: "BPRS Ops Sintetis",
      public_slug: "bprs-ops-sintetis",
      installation_name: "Instalasi Ops Sintetis",
      public_key: publicPem,
      key_id: keyId,
    });
  assert.equal(onboarded.status, 201);
  assert.equal(onboarded.body.status, "ONBOARDED");
  const stored = await owner.query("SELECT public_key FROM institution_keys WHERE key_id = $1", [keyId]);
  assert.equal(stored.rows[0].public_key, publicPem.trim());
  assert.doesNotMatch(stored.rows[0].public_key, /PRIVATE KEY/u);

  await owner.query(
    `INSERT INTO media_objects
      (id, institution_id, source_media_id, logical_object_key, storage_backend, purpose, state, sha256,
       detected_mime, size_bytes, width, height, delivery_object_key, delivery_mime,
       delivery_sha256, delivery_size_bytes, delivery_width, delivery_height, ready_at, created_at, updated_at)
     VALUES
      ($1, $2, gen_random_uuid(), 'delivery/test.webp', 'FILESYSTEM', 'BPRS_PUBLIC_MARK', 'READY', repeat('a', 64),
       'image/webp', 128, 16, 16, 'delivery/test.webp', 'image/webp', repeat('b', 64), 96, 16, 16,
       now(), now(), now())`,
    [mediaId, onboarded.body.subject_id],
  );
  const quarantined = await request(app)
    .post("/v1/ops/quarantines")
    .set("Cookie", cookie)
    .set("X-CSRF-Token", mfaStep.body.csrf_token)
    .send({
      institution_id: onboarded.body.subject_id,
      subject_type: "MEDIA",
      subject_id: mediaId,
      reason_code: "SYNTHETIC_TEST",
    });
  assert.equal(quarantined.status, 201);
  const hiddenState = await owner.query("SELECT state FROM media_objects WHERE id = $1", [mediaId]);
  assert.equal(hiddenState.rows[0].state, "QUARANTINED");

  const resolved = await request(app)
    .post(`/v1/ops/quarantines/${quarantined.body.subject_id}/resolve`)
    .set("Cookie", cookie)
    .set("X-CSRF-Token", mfaStep.body.csrf_token)
    .send({});
  assert.equal(resolved.status, 200);
  const restoredState = await owner.query("SELECT state FROM media_objects WHERE id = $1", [mediaId]);
  assert.equal(restoredState.rows[0].state, "READY");
});
