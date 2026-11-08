import assert from "node:assert/strict";
import test from "node:test";
import { PublicService } from "../../src/public-service.js";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { AllowAllRateLimiter } from "../../src/rate-limit.js";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const requireContract = createRequire(new URL("../../../../packages/contracts/package.json", import.meta.url));
const { load } = requireContract("js-yaml");
const Ajv2020 = requireContract("ajv/dist/2020.js").default;
const addFormats = requireContract("ajv-formats").default;

const base = {
  id: "33333333-3333-4333-8333-333333333333", publicReferenceCode: "SJ-TEST0001",
  title: "Model A & B", description: "Informasi publik", category: "KENDARAAN", subcategoryCode: "MOBIL",
  cityRegency: "Bandung", province: "Jawa Barat", availability: "AVAILABLE", publicUpdatedAt: new Date("2026-09-15T00:00:00.000Z"),
  institution: { publicSlug: "bank-a", legalNameInternal: "PRIVATE" },
  profile: { publicName: "Bank A", publicMarkMediaId: "11111111-1111-4111-8111-111111111111", payloadChecksum: "PRIVATE" },
  whatsappContact: { phoneE164: "+12025550100", sourceContactId: "PRIVATE" },
  media: [{ isCover: true, altText: "Foto aset", mediaObject: { id: "22222222-2222-4222-8222-222222222222", deliveryWidth: 400, deliveryHeight: 300, logicalObjectKey: "PRIVATE" } }],
  vehicleDetail: { brand: "Contoh", modelOrType: "Model A", mileageKm: 0, publicCondition: "BAIK", internalCode: "PRIVATE" },
  payloadChecksum: "PRIVATE", sourcePublicationId: "PRIVATE",
};
function setup(rows: any[] = [base]) {
  const calls: any[] = [];
  const service = new PublicService({ publicRead: {
    publication: { findMany: async (q: any) => { calls.push(q); return rows; }, findFirst: async (q: any) => { calls.push(q); return rows[0]; } },
    institution: { findMany: async (q: any) => { calls.push(q); return []; } },
    mediaObject: { findFirst: async (q: any) => { calls.push(q); return null; } },
  } } as any, { readObject: () => { throw new Error("must not read storage"); } }, "http://127.0.0.1:1/v1/public/media");
  return { service, calls };
}
test("invalid filters never execute an unfiltered database request", async () => {
  const { service, calls } = setup();
  for (const q of [{ price: "100" }, { q: ["a", "b"] }, { q: " " }, { q: "a".repeat(101) }, { limit: "0" }, { limit: "101" }, { limit: "1.5" }, { sort: "random" }, { category: "HOUSE" }, { category: "TANAH", subcategory: "MOBIL" }, { institution: "bank/a" }, { cursor: "%%%" }, { cursor: Buffer.from('{"id":1,"updated_at":0}').toString("base64url") }]) {
    await assert.rejects(service.listAssets(q), (e: any) => e.status === 400);
  }
  for (const q of [{ sort: "NEWEST" }, { q: ["a", "b"] }, { province: " " }, { cursor: "null" }]) await assert.rejects(service.listInstitutions(q), (e: any) => e.status === 400);
  assert.equal(calls.length, 0);
});
test("combined filters normalize province, keep eligibility and deterministic tie breaker", async () => {
  const { service, calls } = setup();
  const result = await service.listAssets({ category: "KENDARAAN", subcategory: "MOBIL", institution: "bank-a", province: "  jawa   barat ", q: "MODEL", sort: "OLDEST", limit: "2" });
  const q = calls[0];
  assert.deepEqual(q.where.province, { equals: "jawa barat", mode: "insensitive" });
  assert.equal(q.where.category, "KENDARAAN"); assert.equal(q.where.subcategoryCode, "MOBIL");
  assert.equal(q.where.institution.publicSlug, "bank-a"); assert.equal(q.where.searchDocument.normalizedText.contains, "model");
  assert.equal(q.where.state, "PUBLISHED"); assert.equal(q.where.availability, "AVAILABLE");
  assert.equal(q.where.profile.state, "ACTIVE"); assert.equal(q.where.whatsappContact.state, "VERIFIED");
  assert.equal(q.where.media.some.isCover, true); assert.equal(q.where.media.some.mediaObject.state, "READY");
  assert.ok(q.where.nextReconfirmationAt.gt instanceof Date);
  assert.deepEqual(q.orderBy, [{ publicUpdatedAt: "asc" }, { id: "asc" }]);
  assert.equal(q.take, 3); assert.equal(result.items.length, 1); assert.equal(result.next_cursor, null);
  assert.deepEqual(Object.keys(result).sort(), ["items", "next_cursor"]);
});
test("cursor round trip accepts normalized equivalent filters but rejects different query/sort or corrupted structure", async () => {
  const { service, calls } = setup([base, { ...base, id: "44444444-4444-4444-8444-444444444444" }]);
  const first = await service.listAssets({ province: "Jawa Barat", limit: "1" });
  assert.equal(first.items.length, 1); assert.ok(first.next_cursor);
  await service.listAssets({ province: " jawa  barat ", limit: "20", cursor: first.next_cursor });
  assert.equal(calls[1].where.OR[1].id.lt, base.id);
  for (const q of [{ province: "Jawa Timur" }, { province: "Jawa Barat", sort: "OLDEST" }, { province: "Jawa Barat", q: "different" }]) {
    await assert.rejects(service.listAssets({ ...q, cursor: first.next_cursor }), (e: any) => e.code === "CURSOR_INVALID");
  }
  const decoded = JSON.parse(Buffer.from(first.next_cursor!, "base64url").toString());
  for (const p of [{ ...decoded, id: {} }, { ...decoded, updated_at: 0 }, { ...decoded, extra: true }, { ...decoded, v: 99 }]) {
    await assert.rejects(service.listAssets({ province: "Jawa Barat", cursor: Buffer.from(JSON.stringify(p)).toString("base64url") }), (e: any) => e.code === "CURSOR_INVALID");
  }
  await assert.rejects(service.listAssets({ province: "Jawa Barat", cursor: first.next_cursor + "=" }), (e: any) => e.code === "CURSOR_INVALID");
});
test("public response keys are closed and zero mileage survives detail and card", async () => {
  const { service, calls } = setup();
  const list = await service.listAssets({});
  const detail = await service.getAsset(base.publicReferenceCode);
  assert.deepEqual(Object.keys(list.items[0]).sort(), ["reference_code", "title", "category", "subcategory", "location", "cover", "institution", "availability", "photo_count", "public_updated_at", "summary_attributes"].sort());
  assert.deepEqual(detail.summary_attributes, { model_or_type: "Model A", mileage_km: 0 });
  assert.equal(detail.attributes.mileage_km, 0);
  assert.equal(JSON.stringify(detail).includes("PRIVATE"), false);
  const wa = new URL(detail.whatsapp_url);
  assert.equal(wa.pathname, "/12025550100"); assert.ok(wa.searchParams.get("text")?.includes("Model A & B"));
  assert.equal(calls.length, 2); // one list, one explicitly requested detail; no per-card query.
});
test("each category maps only its own existing public attributes; optional zero is not omitted", async () => {
  const cases = [
    { category: "TANAH", landDetail: { landAreaM2: 200, contour: "DATAR" }, expected: { land_area_m2: 200, contour: "DATAR" } },
    { category: "BANGUNAN", buildingDetail: { landAreaM2: 0, buildingAreaM2: 120, floorCount: 0 }, expected: { land_area_m2: 0, building_area_m2: 120, floor_count: 0 } },
    { category: "MESIN_PERALATAN", machineDetail: { modelOrType: "A", publicCondition: "BAIK" }, expected: { model_or_type: "A", public_condition: "BAIK" } },
  ];
  for (const example of cases) {
    const { expected, ...fields } = example;
    const { service } = setup([{ ...base, ...fields }]);
    assert.deepEqual((await service.getAsset(base.publicReferenceCode)).attributes, expected);
  }
});
test("malformed identifiers return not-found before DB and hidden media never reaches storage", async () => {
  const { service, calls } = setup([]);
  await assert.rejects(service.getAsset("bad"), (e: any) => e.status === 404);
  await assert.rejects(service.getInstitution("../private"), (e: any) => e.status === 404);
  await assert.rejects(service.readMedia("bad"), (e: any) => e.status === 404);
  assert.equal(calls.length, 0);
  await assert.rejects(service.readMedia(base.id), (e: any) => e.status === 404);
  assert.equal(calls[0].where.OR[0].profileMarks.some.institution.state, "ACTIVE");
});

test("actual HTTP routes reject duplicate/unknown query without querying DB or exposing internals", async () => {
  let calls = 0;
  const app = createApp({
    config: { flags: { ingest: false, mediaUpload: false, publicSite: true }, security: { eventBodyMaxBytes: 262144 }, rateLimit: {}, publicMediaBaseUrl: "http://127.0.0.1:1/v1/public/media" } as any,
    databases: { publicRead: { publication: { findMany: async () => { calls++; return [base]; } }, institution: { findMany: async () => { calls++; return []; } } } } as any,
    storage: {}, ingestLimiter: new AllowAllRateLimiter(), publicLimiter: new AllowAllRateLimiter(),
  });
  for (const path of ["/v1/public/assets?q=a&q=b", "/v1/public/assets?price=100", "/v1/public/assets?cursor=e30", "/v1/public/institutions?q=a&q=b", "/v1/public/institutions?limit=101"]) {
    const response = await request(app).get(path).expect(400);
    assert.equal(response.body.items, undefined); assert.equal(response.body.retryable, false);
  }
  assert.equal(calls, 0);
  const response = await request(app).get("/v1/public/assets?province=jawa%20barat&category=KENDARAAN&subcategory=MOBIL&sort=OLDEST").expect(200);
  assert.equal(response.body.items[0].summary_attributes.mileage_km, 0);
  assert.equal(calls, 1);
});

test("actual service responses validate against closed OpenAPI schemas, including category summaries", async () => {
  const document = load(readFileSync(new URL("../../../../packages/contracts/openapi/openapi.v1.yaml", import.meta.url), "utf8")) as any;
  const ajv = new (Ajv2020 as any)({ strict: false });
  (addFormats as any)(ajv);
  ajv.addSchema({ $id: "urn:sj:public", components: document.components });
  const cardCheck = ajv.compile({ $ref: "urn:sj:public#/components/schemas/PublicAssetCard" });
  const detailCheck = ajv.compile({ $ref: "urn:sj:public#/components/schemas/PublicAssetDetail" });
  const { service } = setup();
  const card = (await service.listAssets({})).items[0];
  const detail = await service.getAsset(base.publicReferenceCode);
  assert.equal(cardCheck(card), true, JSON.stringify(cardCheck.errors));
  assert.equal(detailCheck(detail), true, JSON.stringify(detailCheck.errors));
  assert.equal(cardCheck({ ...card, internal_id: "private" }), false);
  assert.equal(detailCheck({ ...detail, attributes: { ...detail.attributes, borrower_name: "private" } }), false);
  assert.equal(cardCheck({ ...card, summary_attributes: { price: 100 } }), false);
});
