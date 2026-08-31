import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import test from "node:test";
import {
  canonicalJson,
  createContentSha256,
  createSigningMessage,
  payloadChecksum,
  PUBLIC_ATTRIBUTE_VOCABULARIES,
  signIntegrationMessage,
  validateIntegrationEvent,
  validateSchema,
  verifyIntegrationMessage,
} from "../src/index.mjs";

const ids = Object.freeze({
  institution: "11111111-1111-4111-8111-111111111111",
  contact: "22222222-2222-4222-8222-222222222222",
  publication: "33333333-3333-4333-8333-333333333333",
  media: "44444444-4444-4444-8444-444444444444",
  sourceMedia: "55555555-5555-4555-8555-555555555555",
});

const payloads = Object.freeze({
  UPSERT_BPRS_PROFILE: {
    institution_id: ids.institution,
    public_name: "BPRS Contoh Amanah",
    public_mark: ids.media,
    short_description: "Profil sintetis untuk automated test.",
    office_city_regency: "Kota Bandung",
    office_province: "Jawa Barat",
    profile_updated_at: "2026-08-01T00:00:00.000Z",
  },
  UPSERT_WHATSAPP_CONTACT: {
    whatsapp_contact_id: ids.contact,
    institution_id: ids.institution,
    phone_e164: "+628111111111",
    status: "VERIFIED",
    template_version: 1,
    verified_at: "2026-08-01T00:00:00.000Z",
  },
  REVOKE_WHATSAPP_CONTACT: {
    whatsapp_contact_id: ids.contact,
    institution_id: ids.institution,
    status: "REVOKED",
    reason_code: "CONTACT_REPLACED",
    revoked_at: "2026-08-02T00:00:00.000Z",
  },
  UPSERT_PUBLICATION_SNAPSHOT: {
    publication_id: ids.publication,
    reference_code: "SJ-AB12CD34",
    institution_id: ids.institution,
    taxonomy_version: 1,
    category: "BANGUNAN",
    subcategory: "RUMAH",
    title: "Rumah dua lantai",
    description: "Deskripsi sintetis tanpa data nasabah.",
    location: {
      city_regency: "Kota Cimahi",
      province: "Jawa Barat",
    },
    availability: "AVAILABLE",
    attributes: {
      land_area_m2: 126,
      building_area_m2: 148,
      floor_count: 2,
      public_usage: "HUNIAN",
    },
    media: [
      {
        media_id: ids.media,
        checksum: "a".repeat(64),
        position: 1,
        is_cover: true,
        alt_text: "Tampak depan rumah sintetis",
      },
    ],
    whatsapp_contact_id: ids.contact,
    published_at: "2026-08-01T00:00:00.000Z",
    public_updated_at: "2026-08-01T00:00:00.000Z",
    availability_confirmed_at: "2026-08-01T00:00:00.000Z",
    next_confirmation_at: "2026-08-31T00:00:00.000Z",
  },
  UNPUBLISH_PUBLICATION: {
    publication_id: ids.publication,
    institution_id: ids.institution,
    reason_code: "NO_LONGER_AVAILABLE",
    unpublished_at: "2026-08-02T00:00:00.000Z",
  },
  ARCHIVE_PUBLICATION: {
    publication_id: ids.publication,
    institution_id: ids.institution,
    archived_at: "2026-08-03T00:00:00.000Z",
  },
  REVOKE_MEDIA: {
    media_id: ids.media,
    institution_id: ids.institution,
    reason_code: "CONTENT_REVIEW",
    revoked_at: "2026-08-02T00:00:00.000Z",
  },
});

function aggregateIdFor(eventType) {
  if (eventType === "UPSERT_BPRS_PROFILE") return ids.institution;
  if (eventType.includes("WHATSAPP")) return ids.contact;
  if (eventType === "REVOKE_MEDIA") return ids.media;
  return ids.publication;
}

function eventFor(eventType, overrides = {}) {
  const payload = structuredClone(payloads[eventType]);
  const event = {
    event_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    schema_version: 1,
    event_type: eventType,
    institution_id: ids.institution,
    aggregate_id: aggregateIdFor(eventType),
    aggregate_version: 1,
    occurred_at: "2026-08-01T00:00:00.000Z",
    payload_checksum: payloadChecksum(payload),
    payload,
    ...overrides,
  };
  return event;
}

test("tujuh jenis event menerima snapshot sintetis yang sesuai allowlist", () => {
  for (const eventType of Object.keys(payloads)) {
    const result = validateIntegrationEvent(eventFor(eventType));
    assert.equal(result.valid, true, eventType + ": " + JSON.stringify(result.errors));
  }
});

test("unknown field dan field internal ditolak", () => {
  const event = eventFor("UPSERT_PUBLICATION_SNAPSHOT");
  event.payload.nik = "0000000000000000";
  event.payload_checksum = payloadChecksum(event.payload);
  const result = validateIntegrationEvent(event);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.keyword === "additionalProperties"));
});

test("checksum, institution, dan aggregate harus cocok dengan envelope", () => {
  const badChecksum = eventFor("UNPUBLISH_PUBLICATION", {
    payload_checksum: "0".repeat(64),
  });
  assert.ok(
    validateIntegrationEvent(badChecksum).errors.some(
      (error) => error.keyword === "payloadChecksum",
    ),
  );

  const badInstitution = eventFor("UNPUBLISH_PUBLICATION");
  badInstitution.payload.institution_id = "99999999-9999-4999-8999-999999999999";
  badInstitution.payload_checksum = payloadChecksum(badInstitution.payload);
  assert.ok(
    validateIntegrationEvent(badInstitution).errors.some(
      (error) => error.keyword === "institutionMatch",
    ),
  );

  const badAggregate = eventFor("REVOKE_MEDIA", {
    aggregate_id: ids.publication,
  });
  assert.ok(
    validateIntegrationEvent(badAggregate).errors.some(
      (error) => error.keyword === "aggregateMatch",
    ),
  );
});

test("kategori, cover, urutan media, dan konfirmasi 30 hari dikunci", () => {
  const badCategory = eventFor("UPSERT_PUBLICATION_SNAPSHOT");
  badCategory.payload.category = "TANAH";
  badCategory.payload.subcategory = "RUMAH";
  badCategory.payload_checksum = payloadChecksum(badCategory.payload);
  const categoryErrors = validateIntegrationEvent(badCategory).errors;
  assert.ok(categoryErrors.some((error) => error.keyword === "taxonomy"));
  assert.ok(categoryErrors.some((error) => error.keyword === "categoryAttributes"));

  const badMedia = eventFor("UPSERT_PUBLICATION_SNAPSHOT");
  badMedia.payload.media.push({
    ...badMedia.payload.media[0],
    media_id: ids.sourceMedia,
  });
  badMedia.payload_checksum = payloadChecksum(badMedia.payload);
  const mediaErrors = validateIntegrationEvent(badMedia).errors;
  assert.ok(mediaErrors.some((error) => error.keyword === "uniquePosition"));
  assert.ok(mediaErrors.some((error) => error.keyword === "singleCover"));

  const badWindow = eventFor("UPSERT_PUBLICATION_SNAPSHOT");
  badWindow.payload.next_confirmation_at = "2026-09-01T00:00:00.000Z";
  badWindow.payload_checksum = payloadChecksum(badWindow.payload);
  assert.ok(
    validateIntegrationEvent(badWindow).errors.some(
      (error) => error.keyword === "confirmationWindow",
    ),
  );
});

test("vocabulary atribut publik dikunci sesuai keputusan Opsi A", () => {
  assert.deepEqual(PUBLIC_ATTRIBUTE_VOCABULARIES.public_condition, [
    "SANGAT_BAIK",
    "BAIK",
    "CUKUP",
    "PERLU_PERBAIKAN",
  ]);

  const invalidUsage = eventFor("UPSERT_PUBLICATION_SNAPSHOT");
  invalidUsage.payload.attributes.public_usage = "LAINNYA";
  invalidUsage.payload_checksum = payloadChecksum(invalidUsage.payload);
  assert.equal(validateIntegrationEvent(invalidUsage).valid, false);
});

test("media upload dan reconciliation menolak unknown field", () => {
  const upload = {
    institution_id: ids.institution,
    publication_id: ids.publication,
    source_media_id: ids.sourceMedia,
    sha256: "b".repeat(64),
    detected_mime: "image/webp",
    size_bytes: 1024,
    width: 1200,
    height: 800,
    purpose: "PUBLICATION_IMAGE",
    requested_ttl_seconds: 300,
  };
  assert.equal(
    validateSchema(
      "https://seputarjaminan.com/contracts/v1/media-upload-session-request.schema.json",
      upload,
    ).valid,
    true,
  );
  assert.equal(
    validateSchema(
      "https://seputarjaminan.com/contracts/v1/media-upload-session-request.schema.json",
      { ...upload, publication_id: null, purpose: "BPRS_PUBLIC_MARK" },
    ).valid,
    true,
  );
  assert.equal(
    validateSchema(
      "https://seputarjaminan.com/contracts/v1/media-upload-session-request.schema.json",
      { ...upload, publication_id: null, purpose: "PUBLICATION_IMAGE" },
    ).valid,
    false,
  );
  assert.equal(
    validateSchema(
      "https://seputarjaminan.com/contracts/v1/media-upload-session-request.schema.json",
      { ...upload, original_filename: "rahasia.webp" },
    ).valid,
    false,
  );

  const manifest = {
    institution_id: ids.institution,
    generated_at: "2026-08-01T00:00:00.000Z",
    items: [
      {
        aggregate_type: "PUBLICATION",
        aggregate_id: ids.publication,
        aggregate_version: 1,
        expected_public_state: "PUBLISHED",
        payload_checksum: "c".repeat(64),
      },
    ],
  };
  assert.equal(
    validateSchema(
      "https://seputarjaminan.com/contracts/v1/reconciliation-manifest.schema.json",
      manifest,
    ).valid,
    true,
  );
});

test("canonical JSON stabil dan checksum tidak bergantung urutan key", () => {
  const first = { z: 1, a: { y: true, b: "nilai" } };
  const second = { a: { b: "nilai", y: true }, z: 1 };
  assert.equal(canonicalJson(first), canonicalJson(second));
  assert.equal(payloadChecksum(first), payloadChecksum(second));
  assert.throws(() => canonicalJson({ invalid: undefined }));
});

test("pesan V1 dapat ditandatangani dan diverifikasi dengan Ed25519", () => {
  const body = Buffer.from(JSON.stringify(eventFor("ARCHIVE_PUBLICATION")), "utf8");
  const message = createSigningMessage({
    method: "POST",
    path: "/v1/ingest/events",
    timestamp: "2026-08-01T00:00:00.000Z",
    nonce: "nonce-sintetis-untuk-test",
    contentSha256: createContentSha256(body),
  });
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const signature = signIntegrationMessage(message, privateKey);
  assert.equal(verifyIntegrationMessage(message, signature, publicKey), true);
  assert.equal(verifyIntegrationMessage(message + "x", signature, publicKey), false);
  assert.throws(() =>
    createSigningMessage({
      method: "POST",
      path: "/v1/ingest/events?unsafe=true",
      timestamp: "2026-08-01T00:00:00.000Z",
      nonce: "nonce-sintetis-untuk-test",
      contentSha256: createContentSha256(body),
    }),
  );
});
