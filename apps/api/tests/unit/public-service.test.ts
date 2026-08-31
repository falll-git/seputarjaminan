import assert from "node:assert/strict";
import test from "node:test";
import { PublicService } from "../../src/public-service.js";

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
