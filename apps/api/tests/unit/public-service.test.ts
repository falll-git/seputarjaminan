import assert from "node:assert/strict";
import test from "node:test";
import { PublicService } from "../../src/public-service.js";

test("media variants enforce canonical derivative keys and never fall back to an original", async () => {
  const id = "11111111-1111-4111-8111-111111111111", institutionId = "22222222-2222-4222-8222-222222222222";
  const prefix = `institutions/${institutionId}/media/${id}`;
  const media: any = { id, institutionId, deliveryMime: "image/webp", deliveryObjectKey: `${prefix}/main`, derivativeMetadata: { card: {} } };
  const reads: string[] = [];
  const service = new PublicService({ publicRead: { mediaObject: { findFirst: async () => media } } } as any, {
    readObject: async (key: string) => { reads.push(key); if (key.endsWith("/card")) throw Object.assign(new Error(), { code: "ENOENT" }); return { sizeBytes: 10 }; },
  }, "/v1/public/media");
  await assert.rejects(service.readMedia(id, { variant: "original" }), (e: any) => e.status === 400);
  await assert.rejects(service.readMedia(id, { variant: ["main", "card"] }), (e: any) => e.status === 400);
  await assert.rejects(service.readMedia(id, { variant: "card" }), (e: any) => e.status === 404);
  assert.deepEqual(reads, [`${prefix}/card`]);
  await service.readMedia(id, { variant: "thumb" }); // legacy media, no stored thumb
  assert.equal(reads.at(-1), `${prefix}/main`);
  media.deliveryObjectKey = `${prefix}/original`;
  await assert.rejects(service.readMedia(id), (e: any) => e.status === 404);
  assert.equal(reads.length, 2);
});

test("kartu aset publik membawa status dan jumlah foto siap tayang", async () => {
  const publicUpdatedAt = new Date("2026-08-22T08:00:00.000Z");
  const publication = {
    id: "33333333-3333-4333-8333-333333333333",
    publicReferenceCode: "SJ-TEST0001",
    title: "Rumah tinggal dekat pusat kota",
    category: "BANGUNAN",
    subcategoryCode: "RUMAH",
    cityRegency: "Bandung",
    province: "Jawa Barat",
    availability: "AVAILABLE",
    publicUpdatedAt,
    institution: { publicSlug: "bprs-amanah-nasional" },
    profile: {
      publicName: "BPRS Amanah Nasional",
      publicMarkMediaId: "11111111-1111-4111-8111-111111111111",
    },
    media: [
      {
        isCover: true,
        altText: "Tampak depan rumah",
        mediaObject: { id: "22222222-2222-4222-8222-222222222222", deliveryWidth: 1600, deliveryHeight: 1200 },
      },
      {
        isCover: false,
        altText: "Ruang utama rumah",
        mediaObject: { id: "44444444-4444-4444-8444-444444444444", deliveryWidth: 1600, deliveryHeight: 1200 },
      },
    ],
  };
  const databases = {
    publicRead: {
      publication: { findMany: async () => [publication] },
    },
  } as any;
  const service = new PublicService(databases, {}, "http://127.0.0.1:4100/v1/public/media");

  const result = await service.listAssets({ limit: "24" });

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].availability, "AVAILABLE");
  assert.equal(result.items[0].photo_count, 2);
  assert.equal(result.items[0].public_updated_at, publicUpdatedAt.toISOString());
});

test("direktori BPRS menerapkan pencarian dan provinsi di database", async () => {
  let capturedQuery: unknown;
  const databases = {
    publicRead: {
      institution: {
        findMany: async (query: unknown) => {
          capturedQuery = query;
          return [];
        },
      },
    },
  } as any;
  const service = new PublicService(databases, {}, "http://127.0.0.1:4100/v1/public/media");

  const result = await service.listInstitutions({
    q: "Amanah",
    province: "Jawa Tengah",
    limit: "24",
  });

  assert.deepEqual(result, { items: [], next_cursor: null });
  assert.deepEqual((capturedQuery as any).where.profile, {
    state: "ACTIVE",
    officeProvince: { equals: "Jawa Tengah", mode: "insensitive" },
    OR: [
      { publicName: { contains: "Amanah", mode: "insensitive" } },
      { officeCityRegency: { contains: "Amanah", mode: "insensitive" } },
      { officeProvince: { contains: "Amanah", mode: "insensitive" } },
    ],
  });
  assert.equal((capturedQuery as any).take, 25);
});

test("directory counts are bounded to page, never per-card, with unchanged visibility", async () => {
  let countCalls = 0;
  const profiles = ["a", "b", "c"].map((id) => ({ id, publicSlug: `bank-${id}`, profile: { publicName: `Bank ${id}`, publicMarkMediaId: "mark", shortDescription: "", officeCityRegency: "Kota", officeProvince: "Provinsi" } }));
  const service = new PublicService({ publicRead: {
    institution: { findMany: async () => profiles },
    publication: { groupBy: async (query: any) => {
      countCalls++;
      assert.deepEqual(query.where.institutionId.in, ["a", "b"]);
      assert.equal(query.where.state, "PUBLISHED");
      assert.equal(query.where.availability, "AVAILABLE");
      assert.equal(query.where.institution.state, "ACTIVE");
      assert.equal(query.where.profile.state, "ACTIVE");
      assert.equal(query.where.whatsappContact.state, "VERIFIED");
      assert.ok(query.where.nextReconfirmationAt.gt instanceof Date);
      assert.equal(query.where.media.some.mediaObject.state, "READY");
      assert.equal(query.where.media.some.isCover, true);
      return [{ institutionId: "b", _count: { _all: 7 } }, { institutionId: "a", _count: { _all: 3 } }];
    } },
  } } as any, {}, "http://127.0.0.1:4100/v1/public/media");
  const result = await service.listInstitutions({ limit: "2" });
  assert.equal(countCalls, 1);
  assert.deepEqual(result.items.map((item) => [item.public_slug, item.published_asset_count]), [["bank-a", 3], ["bank-b", 7]]);
  assert.ok(result.next_cursor);
  assert.ok(!("id" in result.items[0]));
});

test("detail aset membentuk pesan WhatsApp publik tanpa mengekspos nomor sebagai field terpisah", async () => {
  const publication = {
    id: "33333333-3333-4333-8333-333333333333",
    publicReferenceCode: "SJ-TEST0001",
    title: "Rumah tinggal dekat pusat kota",
    description: "Rumah tinggal dua lantai.",
    category: "BANGUNAN",
    subcategoryCode: "RUMAH",
    cityRegency: "Bandung",
    province: "Jawa Barat",
    availability: "AVAILABLE",
    publicUpdatedAt: new Date("2026-08-22T08:00:00.000Z"),
    institution: { publicSlug: "bprs-amanah-nasional" },
    profile: {
      publicName: "BPRS Amanah Nasional",
      publicMarkMediaId: "11111111-1111-4111-8111-111111111111",
    },
    whatsappContact: { phoneE164: "+628111111111" },
    media: [{
      isCover: true,
      altText: "Tampak depan rumah",
      mediaObject: { id: "22222222-2222-4222-8222-222222222222", deliveryWidth: 1600, deliveryHeight: 1200 },
    }],
    landDetail: null,
    buildingDetail: { landAreaM2: 126, buildingAreaM2: 148, floorCount: 2, publicUsage: "HUNIAN" },
    machineDetail: null,
    vehicleDetail: null,
  };
  const databases = {
    publicRead: {
      publication: { findFirst: async () => publication },
    },
  } as any;
  const service = new PublicService(databases, {}, "http://127.0.0.1:4100/v1/public/media");

  const result = await service.getAsset("SJ-TEST0001");
  const whatsappUrl = new URL(result.whatsapp_url);

  assert.equal(`${whatsappUrl.origin}${whatsappUrl.pathname}`, "https://wa.me/628111111111");
  assert.equal(
    whatsappUrl.searchParams.get("text"),
    "Siang Pak/Bu, saya ingin mengetahui informasi lebih lanjut terkait aset SJ-TEST0001 — Rumah tinggal dekat pusat kota.",
  );
  assert.equal("phone_e164" in result, false);
  assert.equal("phone" in result, false);
});
