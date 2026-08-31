import assert from "node:assert/strict";
import { generateKeyPairSync, randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import pino from "pino";
import pg from "pg";
import request from "supertest";
import {
  createContentSha256,
  createSigningMessage,
  INTEGRATION_HEADERS,
  payloadChecksum,
  signIntegrationMessage,
} from "@seputarjaminan/contracts";
import { FilesystemStorageAdapter } from "@seputarjaminan/storage";
import { createApp } from "../../src/app.js";
import { createDatabaseClients } from "../../src/database.js";
import { AllowAllRateLimiter } from "../../src/rate-limit.js";
import { createWorkerDatabase } from "../../../worker/src/database.js";
import { createMalwareScanner } from "../../../worker/src/malware-scanner.js";
import { CentralWorker } from "../../../worker/src/worker.js";

const { Client } = pg;
const ownerUrl = process.env.SJ_TEST_OWNER_DATABASE_URL;
const registryUrl = process.env.SJ_TEST_REGISTRY_DATABASE_URL;
const ingestUrl = process.env.SJ_TEST_INGEST_DATABASE_URL;
const publicUrl = process.env.SJ_TEST_PUBLIC_DATABASE_URL;
const opsUrl = process.env.SJ_TEST_OPS_DATABASE_URL;
const workerUrl = process.env.SJ_TEST_WORKER_DATABASE_URL;

const institutionId = "d1000000-0000-4000-8000-000000000001";
const installationId = "d2000000-0000-4000-8000-000000000002";
const keyId = "d3000000-0000-4000-8000-000000000003";
const contactId = "d5000000-0000-4000-8000-000000000005";
const publicationId = "d6000000-0000-4000-8000-000000000006";
const logoSourceId = "d7000000-0000-4000-8000-000000000007";
const assetSourceId = "d8000000-0000-4000-8000-000000000008";

async function clearInstitution(owner: InstanceType<typeof Client>) {
  for (const table of [
    "quarantine_records",
    "publication_media",
    "public_search_documents",
    "land_details",
    "building_details",
    "machine_details",
    "vehicle_details",
    "publications",
    "bprs_profiles",
    "whatsapp_contacts",
    "media_upload_sessions",
    "central_jobs",
    "media_objects",
    "reconciliation_runs",
    "aggregate_cursors",
    "ingest_events",
  ]) {
    await owner.query(`DELETE FROM ${table} WHERE institution_id = $1`, [institutionId]);
  }
  await owner.query(
    "DELETE FROM request_nonces WHERE key_id IN (SELECT key_id FROM institution_keys WHERE institution_id = $1)",
    [institutionId],
  );
  await owner.query("DELETE FROM institution_keys WHERE institution_id = $1", [institutionId]);
  await owner.query("DELETE FROM institution_installations WHERE institution_id = $1", [institutionId]);
  await owner.query("DELETE FROM institutions WHERE id = $1", [institutionId]);
}

function signedPost(app: any, route: string, body: unknown, privateKey: any, nonce = randomUUID()) {
  const serialized = JSON.stringify(body);
  const timestamp = new Date().toISOString();
  const digest = createContentSha256(serialized);
  const message = createSigningMessage({
    method: "POST",
    path: route,
    timestamp,
    nonce,
    contentSha256: digest,
  });
  return request(app)
    .post(route)
    .set("Content-Type", "application/json")
    .set(INTEGRATION_HEADERS.institutionId, institutionId)
    .set(INTEGRATION_HEADERS.keyId, keyId)
    .set(INTEGRATION_HEADERS.timestamp, timestamp)
    .set(INTEGRATION_HEADERS.nonce, nonce)
    .set(INTEGRATION_HEADERS.contentSha256, digest)
    .set(INTEGRATION_HEADERS.signature, signIntegrationMessage(message, privateKey))
    .send(serialized);
}

test("alur nyata upload, proses, publish, baca publik, replay, dan unpublish", {
  skip: !ownerUrl || !registryUrl || !ingestUrl || !publicUrl || !opsUrl || !workerUrl,
}, async (context) => {
  const owner = new Client({ connectionString: ownerUrl! });
  await owner.connect();
  await clearInstitution(owner);
  const storageRoot = await mkdtemp(path.join(os.tmpdir(), "sj-flow-"));
  const storage = new FilesystemStorageAdapter({ root: storageRoot });
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const publicPem = publicKey.export({ type: "spki", format: "pem" }).toString();
  await owner.query(
    `INSERT INTO institutions (id, legal_name_internal, public_slug, state, onboarded_at, created_at, updated_at)
     VALUES ($1, 'BPRS Alur Sintetis', 'bprs-alur-sintetis', 'ACTIVE', now(), now(), now())`,
    [institutionId],
  );
  await owner.query(
    `INSERT INTO institution_installations
      (id, institution_id, installation_name, state, contract_version, created_at, updated_at)
     VALUES ($1, $2, 'Ruwang Test', 'ACTIVE', 1, now(), now())`,
    [installationId, institutionId],
  );
  await owner.query(
    `INSERT INTO institution_keys
      (key_id, institution_id, installation_id, public_key, algorithm, state, valid_from, created_at)
     VALUES ($1, $2, $3, $4, 'ED25519', 'ACTIVE', now(), now())`,
    [keyId, institutionId, installationId, publicPem],
  );

  const databases = createDatabaseClients({
    registryDatabaseUrl: registryUrl!,
    ingestDatabaseUrl: ingestUrl!,
    publicDatabaseUrl: publicUrl!,
    opsDatabaseUrl: opsUrl!,
  });
  const workerDatabase = createWorkerDatabase(workerUrl!);
  context.after(async () => {
    await databases.disconnect();
    await workerDatabase.$disconnect();
    await clearInstitution(owner);
    await owner.end();
    await rm(storageRoot, { recursive: true, force: true });
  });

  const config = {
    nodeEnv: "test",
    publicApiBaseUrl: "http://127.0.0.1:4100",
    publicMediaBaseUrl: "http://127.0.0.1:4100/v1/public/media",
    uploadSessionTtlSeconds: 300,
    storage: { provider: "FILESYSTEM" },
    security: {
      eventBodyMaxBytes: 262_144,
      signatureToleranceSeconds: 300,
      nonceTtlSeconds: 600,
      mediaFileMaxBytes: 10_485_760,
      mediaTotalMaxBytes: 52_428_800,
    },
    rateLimit: { ingestPerMinute: 60, publicPerMinute: 600, opsAuthPerMinute: 10 },
    flags: { ingest: true, mediaUpload: true, publicSite: true },
  };
  const app = createApp({
    config,
    databases,
    storage,
    ingestLimiter: new AllowAllRateLimiter(),
    publicLimiter: new AllowAllRateLimiter(),
    logger: pino({ level: "silent" }),
  });
  const worker = new CentralWorker(
    workerDatabase,
    storage as any,
    createMalwareScanner({ mode: "TEST_SAFE", command: "unused" }),
    pino({ level: "silent" }),
    10_485_760,
  );
  const image = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  );
  const imageChecksum = createContentSha256(image);

  async function uploadAndProcess(sourceMediaId: string, purpose: "BPRS_PUBLIC_MARK" | "PUBLICATION_IMAGE") {
    const sessionPayload = {
      institution_id: institutionId,
      publication_id: purpose === "PUBLICATION_IMAGE" ? publicationId : null,
      source_media_id: sourceMediaId,
      sha256: imageChecksum,
      detected_mime: "image/png",
      size_bytes: image.length,
      width: 1,
      height: 1,
      purpose,
      requested_ttl_seconds: 300,
    };
    const created = await signedPost(app, "/v1/media/upload-sessions", sessionPayload, privateKey);
    assert.equal(created.status, 201);
    const uploaded = await request(app)
      .put(new URL(created.body.upload_url).pathname)
      .set(created.body.headers)
      .send(image);
    assert.equal(uploaded.status, 204);
    const completed = await signedPost(
      app,
      `/v1/media/upload-sessions/${created.body.upload_session_id}/complete`,
      { media_id: created.body.media_id },
      privateKey,
    );
    assert.equal(completed.status, 202);
    assert.equal(await worker.runOnce(), true);
    const media = await owner.query("SELECT state, delivery_mime FROM media_objects WHERE id = $1", [created.body.media_id]);
    assert.deepEqual(media.rows[0], { state: "READY", delivery_mime: "image/webp" });
    return created.body.media_id as string;
  }

  const logoMediaId = await uploadAndProcess(logoSourceId, "BPRS_PUBLIC_MARK");
  const assetMediaId = await uploadAndProcess(assetSourceId, "PUBLICATION_IMAGE");
  const now = new Date();
  const nextConfirmation = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  function event(eventType: string, aggregateId: string, aggregateVersion: number, payload: Record<string, unknown>) {
    return {
      event_id: randomUUID(),
      schema_version: 1,
      event_type: eventType,
      institution_id: institutionId,
      aggregate_id: aggregateId,
      aggregate_version: aggregateVersion,
      occurred_at: new Date().toISOString(),
      payload_checksum: payloadChecksum(payload),
      payload,
    };
  }

  const profilePayload = {
    institution_id: institutionId,
    public_name: "BPRS Alur Sintetis",
    public_mark: logoMediaId,
    short_description: "Profil pengujian otomatis tanpa data nasabah.",
    office_city_regency: "Bandung",
    office_province: "Jawa Barat",
    profile_updated_at: now.toISOString(),
  };
  const profileEventResponse = await signedPost(app, "/v1/ingest/events", event("UPSERT_BPRS_PROFILE", institutionId, 1, profilePayload), privateKey);
  assert.equal(profileEventResponse.status, 200, JSON.stringify(profileEventResponse.body));

  const contactPayload = {
    whatsapp_contact_id: contactId,
    institution_id: institutionId,
    phone_e164: "+628111111111",
    status: "VERIFIED",
    template_version: 1,
    verified_at: now.toISOString(),
  };
  assert.equal((await signedPost(app, "/v1/ingest/events", event("UPSERT_WHATSAPP_CONTACT", contactId, 1, contactPayload), privateKey)).status, 200);

  const publicationPayload = {
    publication_id: publicationId,
    reference_code: "SJ-TEST0001",
    institution_id: institutionId,
    taxonomy_version: 1,
    category: "BANGUNAN",
    subcategory: "RUMAH",
    title: "Rumah tinggal dua lantai",
    description: "Hunian dua lantai dengan informasi publik yang telah diperiksa.",
    location: { city_regency: "Bandung", province: "Jawa Barat" },
    availability: "AVAILABLE",
    attributes: { land_area_m2: 126, building_area_m2: 148, floor_count: 2 },
    media: [{ media_id: assetMediaId, checksum: imageChecksum, position: 1, is_cover: true, alt_text: "Tampak depan rumah" }],
    whatsapp_contact_id: contactId,
    published_at: now.toISOString(),
    public_updated_at: now.toISOString(),
    availability_confirmed_at: now.toISOString(),
    next_confirmation_at: nextConfirmation.toISOString(),
  };
  const publicationEvent = event("UPSERT_PUBLICATION_SNAPSHOT", publicationId, 1, publicationPayload);
  const published = await signedPost(app, "/v1/ingest/events", publicationEvent, privateKey);
  assert.equal(published.status, 200, JSON.stringify(published.body));
  assert.equal(published.body.status, "APPLIED");
  const duplicateNonce = randomUUID();
  const duplicate = await signedPost(app, "/v1/ingest/events", publicationEvent, privateKey, duplicateNonce);
  assert.equal(duplicate.status, 200);
  assert.equal(duplicate.body.status, "DUPLICATE");
  const replay = await signedPost(app, "/v1/ingest/events", publicationEvent, privateKey, duplicateNonce);
  assert.equal(replay.status, 409);
  assert.equal(replay.body.code, "REPLAY_REJECTED");
  while (await worker.runOnce()) { /* drain projection jobs */ }

  const publicAsset = await request(app).get("/v1/public/assets/SJ-TEST0001");
  assert.equal(publicAsset.status, 200);
  assert.equal(publicAsset.body.reference_code, "SJ-TEST0001");
  assert.equal(publicAsset.body.institution.public_name, "BPRS Alur Sintetis");
  assert.equal(publicAsset.body.availability, "AVAILABLE");
  assert.equal(publicAsset.body.photo_count, 1);
  assert.match(publicAsset.body.whatsapp_url, /^https:\/\/wa\.me\/628111111111\?text=/u);
  assert.match(decodeURIComponent(publicAsset.body.whatsapp_url), /SJ-TEST0001 — Rumah tinggal dua lantai/u);
  assert.equal("price" in publicAsset.body, false);
  const searched = await request(app).get("/v1/public/assets").query({ q: "rumah", category: "BANGUNAN" });
  assert.equal(searched.status, 200);
  assert.equal(searched.body.items.length, 1);
  assert.equal(searched.body.items[0].availability, "AVAILABLE");
  assert.equal(searched.body.items[0].photo_count, 1);
  assert.equal((await request(app).get("/v1/public/assets").query({ category: "TIDAK_ADA" })).status, 400);
  assert.equal((await request(app).get("/v1/public/assets").query({ limit: "abc" })).status, 400);
  const institutions = await request(app).get("/v1/public/institutions").query({ limit: "1" });
  assert.equal(institutions.status, 200);
  assert.equal(institutions.body.items[0].published_asset_count, 1);

  const unpublishPayload = {
    publication_id: publicationId,
    institution_id: institutionId,
    reason_code: "OWNER_REQUEST",
    unpublished_at: new Date().toISOString(),
  };
  const unpublished = await signedPost(app, "/v1/ingest/events", event("UNPUBLISH_PUBLICATION", publicationId, 2, unpublishPayload), privateKey);
  assert.equal(unpublished.status, 200);
  assert.equal((await request(app).get("/v1/public/assets/SJ-TEST0001")).status, 404);
});
