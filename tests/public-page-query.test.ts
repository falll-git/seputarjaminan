import assert from "node:assert/strict";
import test from "node:test";
import type { PublicAssetCard } from "@seputarjaminan/contracts";
import { parsePublicPageQuery, PublicQueryError, searchParamsRecord } from "../app/lib/public-page-query";
import { toAsset, toAssetDetail } from "../app/data/catalog";

test("URL controls reject duplicates, unsupported values, truncation and unknown fields", () => {
  for (const query of ["q=a&q=b", "category=rumah", "sort=popular", "price=1", "province=", "bprs=bank/a", "cursor=%25", `q=${"a".repeat(101)}`]) {
    assert.throws(() => parsePublicPageQuery(searchParamsRecord(new URLSearchParams(query)), "catalog"), PublicQueryError);
  }
  assert.throws(() => parsePublicPageQuery({ sort: "terbaru" }, "directory"), PublicQueryError);
  assert.throws(() => parsePublicPageQuery({ limit: "100" }, "picker"), PublicQueryError);
});
test("valid controls preserve context and normalize province identically", () => {
  assert.deepEqual(parsePublicPageQuery({ category: "kendaraan", q: "Mobil", province: " jawa   BARAT ", sort: "terlama", bprs: "bank-a" }, "catalog"), { category: "kendaraan", q: "Mobil", province: "jawa BARAT", sort: "terlama", bprs: "bank-a" });
});

test("directory native GET form accepts optional blanks without weakening invalid query checks", () => {
  const parse = (query: string) => parsePublicPageQuery(searchParamsRecord(new URLSearchParams(query)), "directory");
  assert.deepEqual(parse("q=Surabaya&province="), { q: "Surabaya" });
  assert.deepEqual(parse("q=&province=Jawa+Timur"), { province: "Jawa Timur" });
  assert.deepEqual(parse("q=+&province="), {});
  for (const query of ["q=a&q=", "province=&province=Jawa", "cursor=", "cursor=%25", "unknown=", `q=${" ".repeat(101)}`]) {
    assert.throws(() => parse(query), PublicQueryError);
  }
});

test("empty home search opens the unfiltered catalog without accepting duplicate or oversized input", () => {
  assert.deepEqual(parsePublicPageQuery({ q: "" }, "catalog"), {});
  assert.deepEqual(parsePublicPageQuery({ q: "   " }, "catalog"), {});
  assert.throws(() => parsePublicPageQuery({ q: ["", "rumah"] }, "catalog"), PublicQueryError);
  assert.throws(() => parsePublicPageQuery({ q: " ".repeat(101) }, "catalog"), PublicQueryError);
  assert.throws(() => parsePublicPageQuery({ q: "" }, "picker"), PublicQueryError);
});
test("card and detail present legitimate zero, public specs only, without detail fetch", () => {
  const card: PublicAssetCard = { reference_code: "SJ-TEST0001", title: "Kendaraan", category: "KENDARAAN", subcategory: "MOBIL", location: { city_regency: "Kota", province: "Provinsi" }, cover: { url: "/media/22222222-2222-4222-8222-222222222222", width: 400, height: 300, alt_text: "Foto" }, institution: { public_slug: "bank-a", public_name: "Bank A", public_mark_url: "/media/11111111-1111-4111-8111-111111111111" }, availability: "AVAILABLE", photo_count: 1, public_updated_at: "2026-09-15T00:00:00Z", summary_attributes: { mileage_km: 0 } };
  assert.deepEqual(toAsset(card).specs, [{ label: "Jarak tempuh", value: "0 km" }]);
  assert.deepEqual(toAssetDetail({ ...card, description: "Info", media: [card.cover], whatsapp_url: "https://wa.me/12025550100", attributes: { mileage_km: 0 } }).specs, [{ label: "Jarak tempuh", value: "0 km" }]);
});
