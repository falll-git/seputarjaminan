import assert from "node:assert/strict";
import test from "node:test";
import { getPublicAsset, getPublicInstitution, listPublicAssets, PublicApiError } from "../app/lib/public-api";

const media = { url: "/media/22222222-2222-4222-8222-222222222222", width: 400, height: 300, alt_text: "Foto" };
const institution = { public_slug: "bank-a", public_name: "Bank A", public_mark_url: media.url };
const profile = { ...institution, short_description: "Profil bank", office_city_regency: "Kota", office_province: "Provinsi", published_asset_count: 0 };
const card = { reference_code: "SJ-TEST0001", title: "Tanah", category: "TANAH", subcategory: "TANAH", location: { city_regency: "Kota", province: "Provinsi" }, cover: media, institution, availability: "AVAILABLE", photo_count: 1, public_updated_at: "2026-10-04T00:00:00Z" };
const asset = { ...card, description: "Tanah kosong", attributes: { land_area_m2: 0 }, media: [media], whatsapp_url: "https://wa.me/12025550100" };

async function withResponse(payload: unknown, action: () => Promise<unknown>) {
  const originalFetch = globalThis.fetch;
  const originalOrigin = process.env.SJ_PUBLIC_API_BASE_URL;
  process.env.SJ_PUBLIC_API_BASE_URL = "https://catalog.example.invalid";
  globalThis.fetch = async () => new Response(JSON.stringify(payload), { headers: { "Content-Type": "application/json" } });
  try { return await action(); }
  finally {
    globalThis.fetch = originalFetch;
    if (originalOrigin === undefined) delete process.env.SJ_PUBLIC_API_BASE_URL;
    else process.env.SJ_PUBLIC_API_BASE_URL = originalOrigin;
  }
}
const invalid = (error: unknown) => error instanceof PublicApiError && error.status === 502 && error.code === "PUBLIC_RESPONSE_INVALID";

test("public adapter accepts existing optional event proof and legacy omissions without inventing values", async () => {
  for (const extra of [{}, { public_profile_version: 2, public_page_url: "https://website.example.invalid/bprs/bank-a" }, { public_profile_version: 2, public_page_url: null }]) {
    assert.deepEqual(await withResponse({ ...profile, ...extra }, () => getPublicInstitution("bank-a")), { ...profile, ...extra });
  }
  for (const extra of [{}, { public_asset_version: 3, public_page_url: "https://website.example.invalid/aset/SJ-TEST0001" }, { public_asset_version: 3, public_page_url: null }]) {
    assert.deepEqual(await withResponse({ ...asset, ...extra }, () => getPublicAsset("SJ-TEST0001")), { ...asset, ...extra });
  }
});

test("public event versions must be positive safe integers, not draft labels or null", async () => {
  for (const value of [0, -1, 1.5, "2", null, Number.MAX_SAFE_INTEGER + 1]) {
    await assert.rejects(withResponse({ ...profile, public_profile_version: value }, () => getPublicInstitution("bank-a")), invalid);
    await assert.rejects(withResponse({ ...asset, public_asset_version: value }, () => getPublicAsset("SJ-TEST0001")), invalid);
  }
});

test("public page URI must be readable, safe and match the response identity", async () => {
  for (const value of ["", "not-url", "javascript:alert(1)", "https://user:secret@example.invalid/bprs/bank-a", "https://example.invalid/bprs/bank-b", "https://example.invalid/bprs/bank-a?token=private", "https://example.invalid/bprs/bank-a#other", 42]) {
    await assert.rejects(withResponse({ ...profile, public_page_url: value }, () => getPublicInstitution("bank-a")), invalid);
  }
  await assert.rejects(withResponse({ ...asset, public_page_url: "https://example.invalid/aset/SJ-TEST0002" }, () => getPublicAsset("SJ-TEST0001")), invalid);
});

test("unknown/private fields stay rejected on both detail responses", async () => {
  for (const field of ["private_notes", "session_token", "bank_draft_version", "public_asset_version"]) {
    await assert.rejects(withResponse({ ...profile, [field]: 2 }, () => getPublicInstitution("bank-a")), invalid);
  }
  await assert.rejects(withResponse({ ...asset, private_notes: "private" }, () => getPublicAsset("SJ-TEST0001")), invalid);
  await assert.rejects(withResponse({ ...asset, public_profile_version: 2 }, () => getPublicAsset("SJ-TEST0001")), invalid);
});

test("detail identity cannot silently change from the requested profile/asset", async () => {
  await assert.rejects(withResponse({ ...profile, public_slug: "bank-b" }, () => getPublicInstitution("bank-a")), invalid);
  await assert.rejects(withResponse({ ...asset, reference_code: "SJ-TEST0002" }, () => getPublicAsset("SJ-TEST0001")), invalid);
});

test("list card allowlist stays narrow; legitimate zero attributes are retained", async () => {
  const payload = { items: [{ ...card, summary_attributes: { land_area_m2: 0 } }], next_cursor: null };
  assert.deepEqual(await withResponse(payload, () => listPublicAssets()), payload);
  await assert.rejects(withResponse({ items: [{ ...card, public_asset_version: 3 }], next_cursor: null }, () => listPublicAssets()), invalid);
});
