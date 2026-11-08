import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, readFile, stat } from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { assetWhatsappHref, publicationWhatsappDestination } from "../app/lib/public-whatsapp.ts";

const projectRoot = new URL("../", import.meta.url);
const previewRoot = new URL("../app/_sites-preview/", import.meta.url);
const fixtureLogoMediaId = "11111111-1111-4111-8111-111111111111";
const fixtureAssetMediaId = "22222222-2222-4222-8222-222222222222";
const fixtureAssetMediaIdTwo = "55555555-5555-4555-8555-555555555555";
const fixtureAssetMediaIdThree = "66666666-6666-4666-8666-666666666666";
const fixtureAssetMediaIds = new Set([fixtureAssetMediaId, fixtureAssetMediaIdTwo, fixtureAssetMediaIdThree]);
const fixtureWrongTypeMediaId = "33333333-3333-4333-8333-333333333333";
const fixtureMissingMediaId = "44444444-4444-4444-8444-444444444444";
const fixtureWebp = Buffer.from("UklGRnQAAABXRUJQVlA4TGgAAAAvP8YrAQdQ8WbXvf8BAUnS//9kRP8z/vOf//znP//5z3/+85///Oc///nPf/7zn//85z//+c9//vOf//znP//5z3/+85///Oc///nPf/7zn//85z//+c9//vOf//znP//5z3/+83/cAA==", "base64");
const fixtureInstitution = {
  public_slug: "bprs-amanah-nasional",
  public_name: "BPRS Amanah Nasional",
  public_mark_url: `http://127.0.0.1:4100/v1/public/media/${fixtureLogoMediaId}`,
  short_description: "BPRS penerbit yang melayani masyarakat dan pelaku usaha di Bandung.",
  office_city_regency: "Bandung",
  office_province: "Jawa Barat",
  published_asset_count: 1,
};
const fixtureCard = {
  reference_code: "SJ-TEST0001",
  title: "Rumah tinggal dekat pusat kota",
  category: "BANGUNAN",
  subcategory: "RUMAH",
  location: { city_regency: "Bandung", province: "Jawa Barat" },
  cover: {
    url: `http://127.0.0.1:4100/v1/public/media/${fixtureAssetMediaId}`,
    width: 1600,
    height: 1200,
    alt_text: "Tampak depan rumah tinggal",
  },
  institution: {
    public_slug: fixtureInstitution.public_slug,
    public_name: fixtureInstitution.public_name,
    public_mark_url: fixtureInstitution.public_mark_url,
  },
  availability: "AVAILABLE",
  photo_count: 1,
  public_updated_at: "2026-08-22T08:00:00.000Z",
};
const fixtureInstitutions = [
  fixtureInstitution,
  { ...fixtureInstitution, public_slug: "bprs-cakrawala-amanah", public_name: "BPRS Cakrawala Amanah", office_city_regency: "Semarang", office_province: "Jawa Tengah", published_asset_count: 2 },
  { ...fixtureInstitution, public_slug: "bprs-nusa-madani", public_name: "BPRS Nusa Madani", office_city_regency: "Surabaya", office_province: "Jawa Timur", published_asset_count: 1 },
  { ...fixtureInstitution, public_slug: "bprs-sahabat-sejahtera", public_name: "BPRS Sahabat Sejahtera", office_city_regency: "Makassar", office_province: "Sulawesi Selatan", published_asset_count: 3 },
  { ...fixtureInstitution, public_slug: "bprs-utama-nusantara", public_name: "BPRS Utama Nusantara", office_city_regency: "Medan", office_province: "Sumatera Utara", published_asset_count: 1 },
  { ...fixtureInstitution, public_slug: "bprs-lintas-nusantara", public_name: "BPRS Lintas Nusantara", office_city_regency: "Yogyakarta", office_province: "Daerah Istimewa Yogyakarta", published_asset_count: 1 },
  { ...fixtureInstitution, public_slug: "bprs-mitra-pesisir", public_name: "BPRS Mitra Pesisir", office_city_regency: "Padang", office_province: "Sumatera Barat", published_asset_count: 2 },
  { ...fixtureInstitution, public_slug: "bprs-karya-timur", public_name: "BPRS Karya Timur", office_city_regency: "Balikpapan", office_province: "Kalimantan Timur", published_asset_count: 1 },
  { ...fixtureInstitution, public_slug: "bprs-harmoni-sulawesi", public_name: "BPRS Harmoni Sulawesi", office_city_regency: "Manado", office_province: "Sulawesi Utara", published_asset_count: 1 },
];
const fixtureCards = [
  fixtureCard,
  { ...fixtureCard, reference_code: "SJ-TEST0002", title: "Ruko di koridor perdagangan", subcategory: "RUKO", location: { city_regency: "Semarang", province: "Jawa Tengah" }, institution: { public_slug: fixtureInstitutions[1].public_slug, public_name: fixtureInstitutions[1].public_name, public_mark_url: fixtureInstitutions[1].public_mark_url } },
  { ...fixtureCard, reference_code: "SJ-TEST0003", title: "Tanah dekat kawasan usaha", category: "TANAH", subcategory: "TANAH", location: { city_regency: "Surabaya", province: "Jawa Timur" }, institution: { public_slug: fixtureInstitutions[2].public_slug, public_name: fixtureInstitutions[2].public_name, public_mark_url: fixtureInstitutions[2].public_mark_url } },
  { ...fixtureCard, reference_code: "SJ-TEST0004", title: "Mesin produksi untuk kegiatan usaha", category: "MESIN_PERALATAN", subcategory: "MESIN_MANUFAKTUR", location: { city_regency: "Makassar", province: "Sulawesi Selatan" }, institution: { public_slug: fixtureInstitutions[3].public_slug, public_name: fixtureInstitutions[3].public_name, public_mark_url: fixtureInstitutions[3].public_mark_url } },
  { ...fixtureCard, reference_code: "SJ-TEST0005", title: "Kendaraan niaga untuk operasional", category: "KENDARAAN", subcategory: "TRUK", location: { city_regency: "Medan", province: "Sumatera Utara" }, institution: { public_slug: fixtureInstitutions[4].public_slug, public_name: fixtureInstitutions[4].public_name, public_mark_url: fixtureInstitutions[4].public_mark_url } },
];
// Explicit isolated browser fixture only; never a normal API/data fallback.
if (process.env.SJ_OPS03_PICKER_FIXTURE === "true") {
  for (let n = 1; n <= 35; n++) fixtureInstitutions.push({ ...fixtureInstitution,
    public_slug: `bprs-pilihan-${String(n).padStart(2, "0")}`, public_name: `BPRS Uji Pilihan ${String(n).padStart(2, "0")}`,
  });
}
const fixtureDetail = {
  ...fixtureCard,
  description: "Rumah tinggal dua lantai dengan akses menuju pusat Kota Bandung.",
  attributes: {
    land_area_m2: 126,
    building_area_m2: 148,
    floor_count: 2,
    public_usage: "HUNIAN",
  },
  media: [fixtureCard.cover],
  whatsapp_url: "https://wa.me/628111111111?text=Siang%20Pak%2FBu%2C%20saya%20ingin%20mengetahui%20informasi%20lebih%20lanjut%20terkait%20aset%20SJ-TEST0001%20%E2%80%94%20Rumah%20tinggal%20dekat%20pusat%20kota.",
};
const fixtureGalleryMedia = [
  fixtureCard.cover,
  { ...fixtureCard.cover, url: `http://127.0.0.1:4100/v1/public/media/${fixtureAssetMediaIdTwo}`, alt_text: "Tampak samping rumah tinggal" },
  { ...fixtureCard.cover, url: `http://127.0.0.1:4100/v1/public/media/${fixtureAssetMediaIdThree}`, alt_text: "Ruang utama rumah tinggal" },
];
const fixtureTaxonomy = {
  version: 1,
  categories: {
    TANAH: ["TANAH"],
    BANGUNAN: ["RUMAH", "RUKO", "KIOS", "KANTOR", "GUDANG", "PABRIK"],
    MESIN_PERALATAN: ["EXCAVATOR", "BULDOSER", "CRANE", "MESIN_MANUFAKTUR", "PERALATAN_KONSTRUKSI", "PERALATAN_PERTANIAN", "PERALATAN_MEDIS"],
    KENDARAAN: ["MOBIL", "MOTOR", "TRUK", "BUS"],
  },
  vocabularies: {
    public_condition: ["SANGAT_BAIK", "BAIK", "CUKUP", "PERLU_PERBAIKAN"],
    contour: ["DATAR", "MIRING", "BERKONTUR"],
    road_access: ["RODA_DUA", "MOBIL", "TRUK"],
    public_usage: ["HUNIAN", "KOMERSIAL", "PERKANTORAN", "PERGUDANGAN", "INDUSTRI", "SERBAGUNA"],
    transmission: ["MANUAL", "OTOMATIS"],
    fuel_type: ["BENSIN", "DIESEL", "LISTRIK", "HIBRIDA", "GAS"],
  },
};

let fixtureServer;
let fixtureBaseUrl;
let fixtureFailureMode = false;
let visualHoldReady = false;
let websiteProcess;
let websiteBaseUrl;
let websiteOutput = "";
let upstreamMediaRequestCount = 0;
let fixtureAssetCount = readFixtureCount("SJ_VISUAL_FIXTURE_ASSET_COUNT", 1, fixtureCards.length);
let fixtureInstitutionCount = readFixtureCount("SJ_VISUAL_FIXTURE_INSTITUTION_COUNT", 1, fixtureInstitutions.length);
let fixtureMediaCount = readFixtureCount("SJ_VISUAL_FIXTURE_MEDIA_COUNT", 1, fixtureGalleryMedia.length);
let fixtureDetailVariant = "normal";

const longVisualTitle = "Rumah tinggal dan ruang usaha keluarga dengan akses lingkungan yang sangat panjang untuk pengujian keterbacaan";
const longVisualInstitutionName = "BPRS Amanah Nasional untuk Pengembangan Ekonomi Masyarakat dan Usaha Daerah";
const longVisualDescription = "Aset ini menggunakan uraian publik yang sengaja sangat panjang untuk memastikan susunan halaman, kartu, modal, dan profil tetap terbaca tanpa memotong informasi, menutup tombol, atau menimbulkan gulir horizontal pada layar kecil.";

function visualFixtureVariant() {
  return visualHoldReady ? (process.env.SJ_VISUAL_FIXTURE_VARIANT ?? "normal") : "normal";
}

function visualInstitution(institution) {
  const variant = visualFixtureVariant();
  if (variant === "long") {
    return {
      ...institution,
      public_name: institution.public_slug === fixtureInstitution.public_slug ? longVisualInstitutionName : institution.public_name,
      short_description: institution.public_slug === fixtureInstitution.public_slug ? longVisualDescription : institution.short_description,
    };
  }
  if (variant === "broken") {
    return {
      ...institution,
      public_mark_url: `http://127.0.0.1:4100/v1/public/media/${fixtureMissingMediaId}`,
    };
  }
  return institution;
}

function visualCard(card) {
  const institution = visualInstitution(card.institution);
  if (visualFixtureVariant() === "long" && card.reference_code === fixtureCard.reference_code) {
    return { ...card, title: longVisualTitle, institution };
  }
  if (visualFixtureVariant() === "broken") {
    return {
      ...card,
      institution,
      cover: { ...card.cover, url: `http://127.0.0.1:4100/v1/public/media/${fixtureMissingMediaId}` },
    };
  }
  return { ...card, institution };
}

function visualDetail(override) {
  const card = {
    ...visualCard(fixtureDetail),
    media: fixtureGalleryMedia.slice(0, fixtureMediaCount),
    photo_count: fixtureGalleryMedia.slice(0, fixtureMediaCount).length,
  };
  const variant = override ?? (fixtureDetailVariant !== "normal" ? fixtureDetailVariant : visualFixtureVariant());
  if (variant === "invalid-wa") return { ...card, whatsapp_url: "https://example.org/contact" };
  if (variant === "missing-wa") return { ...card, whatsapp_url: "" };
  if (variant === "partial") return { ...card, attributes: {} };
  if (variant === "invalid-status") return { ...card, availability: "SOLD" };
  if (variant === "long") {
    return { ...card, title: longVisualTitle, institution: { ...card.institution, public_name: longVisualInstitutionName }, description: longVisualDescription };
  }
  if (variant === "broken") {
    return {
      ...card,
      media: fixtureGalleryMedia.slice(0, fixtureMediaCount).map((media) => ({
        ...media,
        url: `http://127.0.0.1:4100/v1/public/media/${fixtureMissingMediaId}`,
      })),
    };
  }
  return card;
}

function readFixtureCount(name, fallback, maximum) {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isInteger(parsed) && parsed >= 0 ? Math.min(parsed, maximum) : fallback;
}

function json(response, payload, status = 200) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(payload));
}

before(async () => {
  fixtureServer = http.createServer(async (request, response) => {
    if (visualFixtureVariant() === "slow") {
      await new Promise((resolve) => setTimeout(resolve, 4_200));
    }
    if (fixtureFailureMode || visualFixtureVariant() === "error") {
      return json(response, { code: "UPSTREAM_UNAVAILABLE", message: "Layanan data sedang tidak tersedia." }, 503);
    }
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    // Zero-data review is isolated here: no publication, profile or media specimen
    // remains accessible by a guessed URL once the empty preview is ready.
    if (visualHoldReady && process.env.SJ_VISUAL_FIXTURE_EMPTY === "true") {
      if (url.pathname === "/v1/public/taxonomy") return json(response, fixtureTaxonomy);
      if (["/v1/public/assets", "/v1/public/institutions", "/v1/public/showcase"].includes(url.pathname)) return json(response, { items: [], next_cursor: null });
      return json(response, { code: "NOT_FOUND", message: "Publikasi tidak tersedia." }, 404);
    }
    const mediaId = url.pathname.match(/^\/v1\/public\/media\/([0-9a-f-]+)$/iu)?.[1];
    if (mediaId) {
      upstreamMediaRequestCount += 1;
      if (mediaId === fixtureWrongTypeMediaId) {
        response.writeHead(200, {
          "content-type": "text/html",
          "cross-origin-resource-policy": "same-origin",
        });
        response.end("<p>bukan gambar</p>");
        return;
      }
      if (mediaId === fixtureLogoMediaId || fixtureAssetMediaIds.has(mediaId)) {
        response.writeHead(200, {
          "content-type": "image/webp",
          "content-length": String(fixtureWebp.length),
          "cache-control": "public, max-age=300",
          "cross-origin-resource-policy": "same-origin",
        });
        response.end(fixtureWebp);
        return;
      }
      return json(response, { code: "MEDIA_NOT_FOUND", message: "Gambar tidak tersedia." }, 404);
    }
    if (url.pathname === "/v1/public/taxonomy") return json(response, fixtureTaxonomy);
    // Edge specimens exist only in this isolated test server, never in application routes/data.
    const edge = url.pathname.match(/^\/v1\/public\/assets\/(SJ-TEST009([1-8]))$/u);
    if (edge) {
      const variant = ["long", "broken", "invalid-wa", "missing-wa", "partial", "inactive", "invalid-status", "single"][Number(edge[2]) - 1];
      if (variant === "inactive") return json(response, { code: "ASSET_NOT_FOUND", message: "Aset tidak tersedia." }, 404);
      const detail = visualDetail(variant);
      return json(response, { ...detail, reference_code: edge[1], photo_count: variant === "single" ? 1 : detail.media.length, media: variant === "single" ? detail.media.slice(0, 1) : detail.media });
    }
    if (url.pathname === "/v1/public/assets/SJ-TEST0001") {
      if (fixtureDetailVariant === "inactive" || visualFixtureVariant() === "inactive") return json(response, { code: "ASSET_NOT_FOUND", message: "Aset tidak tersedia." }, 404);
      const detail = visualDetail();
      return json(response, {
        ...detail,
        photo_count: fixtureMediaCount,
        media: detail.media ?? fixtureGalleryMedia.slice(0, fixtureMediaCount),
      });
    }
    if (url.pathname === "/v1/public/institutions/bprs-amanah-nasional") {
      const publishedAssetCount = fixtureCards
        .slice(0, fixtureAssetCount)
        .filter((card) => card.institution.public_slug === fixtureInstitution.public_slug).length;
      return json(response, { ...visualInstitution(fixtureInstitution), published_asset_count: publishedAssetCount });
    }
    const profileSlug = url.pathname.match(/^\/v1\/public\/institutions\/([a-z0-9-]+)$/u)?.[1];
    if (profileSlug?.startsWith("bprs-test-")) {
      const variant = profileSlug.slice("bprs-test-".length);
      if (variant === "error") return json(response, { code: "UPSTREAM_UNAVAILABLE", message: "Profil belum dapat dimuat." }, 503);
      return json(response, {
        ...fixtureInstitution, public_slug: profileSlug,
        public_name: variant === "long" ? longVisualInstitutionName : fixtureInstitution.public_name,
        short_description: variant === "long" ? longVisualDescription : fixtureInstitution.short_description,
        public_mark_url: variant === "broken" ? `http://127.0.0.1:4100/v1/public/media/${fixtureMissingMediaId}` : fixtureInstitution.public_mark_url,
        published_asset_count: variant === "empty" ? 0 : variant === "paginated" ? 5 : 1,
      });
    }
    if (profileSlug) {
      const profile = fixtureInstitutions.find(item => item.public_slug === profileSlug);
      if (profile) return json(response, visualInstitution(profile));
    }
    if (url.pathname === "/v1/public/showcase") return json(response, { items: fixtureCards.slice(0, Math.min(8, fixtureAssetCount)).map(visualCard), next_cursor: null });
    if (url.pathname === "/v1/public/assets") {
      const category = url.searchParams.get("category");
      const institution = url.searchParams.get("institution");
      if (institution?.startsWith("bprs-test-")) {
        if (institution === "bprs-test-assets-error") return json(response, { code: "UPSTREAM_UNAVAILABLE", message: "Aset belum dapat dimuat." }, 503);
        const items = institution === "bprs-test-empty" ? [] : fixtureCards.slice(0, institution === "bprs-test-paginated" ? 2 : 1).map(card => ({ ...card, institution: { ...card.institution, public_slug: institution } }));
        return json(response, { items, next_cursor: institution === "bprs-test-paginated" && !url.searchParams.has("cursor") ? "fixture-profile-page-2" : null });
      }
      const province = url.searchParams.get("province");
      const query = url.searchParams.get("q")?.toLocaleLowerCase("id-ID");
      if (query === "__api-failure__") {
        return json(response, { code: "UPSTREAM_UNAVAILABLE", message: "Layanan data sedang tidak tersedia." }, 503);
      }
      if (query === "__timeout__") {
        await new Promise((resolve) => setTimeout(resolve, 5_200));
      }
      if (query === "__slow__") {
        await new Promise((resolve) => setTimeout(resolve, 4_200));
      }
      const filterQuery = query === "__slow__" || query === "__pagination__" ? undefined : query;
      if (query === "__media-failure__") {
        return json(response, {
          items: [{
            ...fixtureCard,
            cover: { ...fixtureCard.cover, url: `http://127.0.0.1:4100/v1/public/media/${fixtureMissingMediaId}` },
          }],
          next_cursor: null,
        });
      }
      if (query === "__ratio-failure__") {
        return json(response, {
          items: [{ ...fixtureCard, cover: { ...fixtureCard.cover, width: 16, height: 9 } }],
          next_cursor: null,
        });
      }
      if (query === "__alt-failure__") {
        return json(response, {
          items: [{ ...fixtureCard, cover: { ...fixtureCard.cover, alt_text: "   " } }],
          next_cursor: null,
        });
      }
      if (query === "__internal-leak__") return json(response, { items: [{ ...fixtureCard, source_publication_id: "private" }], next_cursor: null });
      if (query === "__attribute-leak__") return json(response, { items: [{ ...fixtureCard, summary_attributes: { borrower_name: "private" } }], next_cursor: null });
      const visible = fixtureCards.slice(0, fixtureAssetCount).map(visualCard).filter((card) => (!category || category === card.category)
        && (!institution || institution === card.institution.public_slug)
        && (!province || province.toLocaleLowerCase("id-ID") === card.location.province.toLocaleLowerCase("id-ID"))
        && (!filterQuery || JSON.stringify(card).toLocaleLowerCase("id-ID").includes(filterQuery)));
      if (query === "__pagination__") {
        const offset = url.searchParams.get("cursor") === "fixture-page-2" ? 2 : 0;
        return json(response, { items: visible.slice(offset, offset + 2), next_cursor: offset === 0 && visible.length > 2 ? "fixture-page-2" : null });
      }
      return json(response, { items: visible, next_cursor: null });
    }
    if (url.pathname === "/v1/public/institutions") {
      const query = url.searchParams.get("q")?.toLocaleLowerCase("id-ID");
      const province = url.searchParams.get("province")?.toLocaleLowerCase("id-ID");
      if (query === "__api-failure__") return json(response, { code: "UPSTREAM_UNAVAILABLE", message: "Direktori belum dapat dimuat." }, 503);
      if (query === "__long__") return json(response, { items: [{ ...fixtureInstitution, public_name: longVisualInstitutionName, public_slug: "bprs-test-long" }], next_cursor: null });
      if (query === "__pagination__") {
        const offset = url.searchParams.has("cursor") ? 2 : 0;
        return json(response, { items: fixtureInstitutions.slice(offset, offset + 2), next_cursor: offset === 0 ? "fixture-bprs-page-2" : null });
      }
      if (query === "__logo-failure__") {
        return json(response, {
          items: [{
            ...fixtureInstitution,
            public_mark_url: `http://127.0.0.1:4100/v1/public/media/${fixtureMissingMediaId}`,
          }],
          next_cursor: null,
        });
      }
      const visible = fixtureInstitutions.slice(0, fixtureInstitutionCount).map(visualInstitution).filter((institution) => (!query || JSON.stringify(institution).toLocaleLowerCase("id-ID").includes(query))
        && (!province || institution.office_province.toLocaleLowerCase("id-ID") === province));
      const limit = Math.min(100, Number(url.searchParams.get("limit")) || 24);
      const offset = Number(url.searchParams.get("cursor")?.replace(/^fixture-offset-/, "")) || 0;
      return json(response, { items: visible.slice(offset, offset + limit), next_cursor: offset + limit < visible.length ? `fixture-offset-${offset + limit}` : null });
    }
    return json(response, { code: "NOT_FOUND", message: "Data tidak tersedia." }, 404);
  });
  await new Promise((resolve, reject) => {
    fixtureServer.once("error", reject);
    fixtureServer.listen(0, "127.0.0.1", () => resolve());
  });
  const address = fixtureServer.address();
  assert.ok(address && typeof address === "object");
  fixtureBaseUrl = `http://127.0.0.1:${address.port}`;

  const websitePort = await findAvailablePort();
  websiteBaseUrl = `http://127.0.0.1:${websitePort}`;
  websiteProcess = spawn(
    process.execPath,
    [fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url)), "start", "--hostname", "127.0.0.1", "--port", String(websitePort)],
    {
      cwd: fileURLToPath(projectRoot),
      env: {
        ...process.env,
        NODE_ENV: "production",
        SJ_ALLOW_LOOPBACK_API: "true",
        SJ_PUBLIC_API_BASE_URL: fixtureBaseUrl,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  websiteProcess.stdout.on("data", (chunk) => { websiteOutput += chunk.toString(); });
  websiteProcess.stderr.on("data", (chunk) => { websiteOutput += chunk.toString(); });
  await waitForWebsite();
  if (process.env.SJ_VISUAL_FIXTURE_HOLD === "true") {
    process.stdout.write(`VISUAL_FIXTURE_URL=${websiteBaseUrl}\n`);
  }
});

after(async () => {
  if (process.env.SJ_VISUAL_FIXTURE_HOLD === "true") {
    visualHoldReady = true;
    process.stdout.write(`VISUAL_FIXTURE_READY=${websiteBaseUrl}\n`);
    await new Promise((resolve) => {
      process.once("SIGINT", resolve);
      process.once("SIGTERM", resolve);
    });
  }
  if (websiteProcess && websiteProcess.exitCode === null) {
    const stopped = new Promise((resolve) => websiteProcess.once("exit", resolve));
    websiteProcess.kill();
    await Promise.race([stopped, new Promise((resolve) => setTimeout(resolve, 5_000))]);
  }
  if (fixtureServer) await new Promise((resolve) => fixtureServer.close(resolve));
});

async function findAvailablePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address === "object");
  await new Promise((resolve) => server.close(resolve));
  return address.port;
}

async function waitForWebsite() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (websiteProcess.exitCode !== null) {
      throw new Error(`Server Next.js berhenti sebelum siap.\n${websiteOutput}`);
    }
    try {
      const response = await fetch(websiteBaseUrl, { signal: AbortSignal.timeout(2_000) });
      if (response.status === 200) return;
    } catch {
      // Server masih mulai; coba lagi hingga batas waktu.
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Server Next.js tidak siap dalam 30 detik.\n${websiteOutput}`);
}

async function render(pathname = "/") {
  return fetch(`${websiteBaseUrl}${pathname}`, {
    headers: { accept: "text/html" },
    signal: AbortSignal.timeout(10_000),
  });
}

test("server merender beranda dari fixture API khusus tes", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Seputar Jaminan by ruwang<\/title>/i);
  assert.match(html, /Jelajahi aset dari BPRS/);
  assert.match(html, /Tiga langkah sederhana/);
  assert.match(html, /og-v4\.png/);
  assert.match(html, /href="\/katalog"/);
  assert.match(html, /href="\/bprs"/);
  assert.match(html, /href="\/cara-minat"/);
  if (fixtureAssetCount > 0) {
    assert.match(html, /Rumah tinggal dekat pusat kota/);
    assert.match(html, new RegExp(`/media/${fixtureAssetMediaId}`, "i"));
  } else {
    assert.match(html, /Belum ada aset yang diterbitkan/);
    assert.doesNotMatch(html, /Rumah tinggal dekat pusat kota/);
  }
  if (fixtureInstitutionCount > 0) {
    assert.match(html, /BPRS Amanah Nasional/);
    assert.match(html, /BPRS yang terhubung/);
    assert.match(html, new RegExp(`/media/${fixtureLogoMediaId}`, "i"));
  } else {
    assert.match(html, /Belum ada BPRS dengan aset yang tersedia/);
  }
  assert.doesNotMatch(html, /127\.0\.0\.1:4100\/v1\/public\/media/i);
  assert.doesNotMatch(html, /images\.unsplash/i);
  if (fixtureAssetCount > 1) {
    assert.match(html, /Aset berikutnya/);
    // Autoplay controls wait for the client's motion preference; SSR stays static.
    assert.doesNotMatch(html, /aria-label="Jeda carousel"/);
  }
});

test("FAQ publik berisi enam pertanyaan, jawaban SSR dan tidak mengirim WhatsApp", async () => {
  const html = await (await render("/")).text();
  const faq = html.match(/<section[^>]*data-home-section="faq"[\s\S]*?<\/section>/)?.[0];
  assert.ok(faq, "FAQ tersedia dalam HTML tanpa menunggu JS");
  assert.equal((faq.match(/<summary>/g) ?? []).length, 6);
  assert.equal((faq.match(/<details name="home-faq">/g) ?? []).length, 6);
  assert.match(faq, /Apakah saya perlu membuat akun/);
  assert.match(faq, /provinsi aset dan BPRS/);
  assert.match(faq, /kontak yang ditentukan BPRS/);
  assert.match(faq, /mengubahnya sebelum mengirim sendiri/);
  assert.doesNotMatch(faq, /href="https?:|<form|<input/);
  assert.ok(html.indexOf('data-home-section="guide"') < html.indexOf('data-home-section="faq"'));
});

test("ilustrasi membedakan kosong, tidak cocok, error, profil kosong dan 404", async () => {
  const originalAssetCount = fixtureAssetCount;
  const originalInstitutionCount = fixtureInstitutionCount;
  try {
    fixtureAssetCount = 0; fixtureInstitutionCount = 0;
    const home = await (await render("/")).text();
    assert.match(home, /data-state-art="catalog" aria-hidden="true"/);
    assert.match(home, /data-state-art="directory" aria-hidden="true"/);
    assert.doesNotMatch(home, /data-asset-card=|Jeda carousel|Jeda animasi logo/);
    const catalog = await (await render("/katalog")).text();
    assert.match(catalog, /data-public-state="empty"/);
    assert.doesNotMatch(catalog, /Muat ulang katalog|Atur ulang pencarian/);
    const search = await (await render("/katalog?q=tidak-cocok")).text();
    assert.match(search, /data-public-state="no-results"/);
    assert.match(search, /data-state-art="search"/);
    assert.match(search, /Atur ulang pencarian/);
    const error = await (await render("/katalog?q=__api-failure__")).text();
    assert.match(error, /data-public-state="error"/);
    assert.match(error, /data-state-art="error"/);
    assert.match(error, /Coba muat ulang/);
    assert.doesNotMatch(error, /data-public-state="empty"|data-asset-card=/);
    const profile = await (await render("/bprs/bprs-test-empty")).text();
    assert.match(profile, /data-state-art="profile"/);
    const missing = await (await render("/alamat-tidak-tersedia")).text();
    assert.match(missing, /data-state-art="missing"/);
  } finally { fixtureAssetCount = originalAssetCount; fixtureInstitutionCount = originalInstitutionCount; }
});

test("OPS03 URL invalid is not an unfiltered catalogue; public response leakage fails closed", async () => {
  for (const path of ["/katalog?category=invalid", "/katalog?q=a&q=b", "/katalog?sort=popular", "/katalog?province=", "/bprs?cursor=%25", "/bprs?q=a&q=b"]) {
    const html = await (await render(path)).text();
    assert.match(html, /Pencarian atau halaman tidak valid/);
    assert.doesNotMatch(html, /data-asset-card=/);
  }
  for (const query of ["__internal-leak__", "__attribute-leak__"]) {
    const html = await (await render(`/katalog?q=${query}`)).text();
    assert.match(html, /Katalog belum dapat dimuat/);
    assert.doesNotMatch(html, /data-asset-card=|source_publication_id|borrower_name/);
  }
});

test("OPS03 picker proxy is bounded and rejects duplicate or unsupported query parameters", async () => {
  const response = await fetch(`${websiteBaseUrl}/api/public/institutions`);
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.ok(payload.items.length <= 20);
  assert.deepEqual(Object.keys(payload).sort(), ["items", "next_cursor"]);
  for (const query of ["q=a&q=b", "limit=1000", "price=1", "cursor=%25"]) {
    assert.equal((await fetch(`${websiteBaseUrl}/api/public/institutions?${query}`)).status, 400);
  }
});

test("proxy media same-origin hanya meneruskan WebP publik dengan header aman", async () => {
  const response = await fetch(`${websiteBaseUrl}/media/${fixtureAssetMediaId}`, {
    headers: { accept: "image/webp" },
    signal: AbortSignal.timeout(10_000),
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/webp");
  assert.equal(response.headers.get("cross-origin-resource-policy"), "same-origin");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("content-disposition"), "inline; filename=\"media.webp\"");
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), fixtureWebp);
});

test("proxy menolak ID tidak valid sebelum menyentuh API dan menolak MIME non-gambar", async () => {
  const beforeInvalidRequest = upstreamMediaRequestCount;
  const invalid = await fetch(`${websiteBaseUrl}/media/bukan-uuid`, { signal: AbortSignal.timeout(10_000) });
  assert.equal(invalid.status, 404);
  assert.equal(upstreamMediaRequestCount, beforeInvalidRequest);

  const wrongType = await fetch(`${websiteBaseUrl}/media/${fixtureWrongTypeMediaId}`, { signal: AbortSignal.timeout(10_000) });
  assert.equal(wrongType.status, 502);
  assert.equal(wrongType.headers.get("x-content-type-options"), "nosniff");
});

test("endpoint modal hanya mengirim URL media same-origin ke browser", async () => {
  const response = await fetch(`${websiteBaseUrl}/api/public/assets/SJ-TEST0001`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  assert.equal(response.status, 200);
  const text = await response.text();
  const payload = JSON.parse(text);
  assert.equal(payload.cover.url, `/media/${fixtureAssetMediaId}`);
  assert.equal(payload.media[0].url, `/media/${fixtureAssetMediaId}`);
  assert.equal(payload.institution.public_mark_url, `/media/${fixtureLogoMediaId}`);
  assert.doesNotMatch(text, /127\.0\.0\.1:4100|\/v1\/public\/media/i);
});

test("alt text kosong menghasilkan fallback visual tanpa ikon gambar bawaan browser", async () => {
  const response = await render("/katalog?q=__alt-failure__");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /data-media-state="invalid-alt"/);
  assert.match(html, /Keterangan foto perlu diperbaiki/);
  assert.doesNotMatch(html, new RegExp(`<img[^>]+${fixtureAssetMediaId}`, "i"));
});

test("design system publik mengunci token semantik, bentuk, dan Phosphor", async () => {
  const [layout, designSystem, globals, editorial, routes, siteHeader, packageJson] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/design-system.css", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/editorial.css", import.meta.url), "utf8"),
    readFile(new URL("../app/routes.css", import.meta.url), "utf8"),
    readFile(new URL("../app/components/SiteHeader.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  const publicStyles = `${designSystem}\n${globals}\n${editorial}\n${routes}`;

  assert.match(layout, /design-system\.css/);
  const tokens = await readFile(new URL("../app/design-tokens.css", import.meta.url), "utf8");
  assert.match(layout, /design-tokens\.css/);
  assert.match(tokens, /--type-display-hero:[^;]+3\.25rem/);
  assert.match(tokens, /--type-page-title:[^;]+3rem/);
  assert.match(tokens, /--type-body:\s*1\.0625rem/);
  assert.match(tokens, /--type-meta:\s*\.875rem/);
  assert.match(tokens, /--icon-action:\s*1\.5rem/);
  assert.match(tokens, /--icon-primary:\s*1\.875rem/);
  assert.match(tokens, /--radius-modal:\s*1\.25rem/);
  assert.match(tokens, /--error:\s*var\(--color-status-error-text\)/);
  assert.match(designSystem, /input:focus-visible,[\s\S]*select:focus-visible\s*\{\s*outline: 3px solid var\(--focus-ring\);\s*outline-offset: 4px;/);
  assert.match(designSystem, /prefers-reduced-motion/);
  assert.match(tokens, /--iris:\s*var\(--color-link\)/);
  assert.match(editorial, /\.dossier-toolbar svg \{ width: var\(--icon-primary\); height: var\(--icon-primary\); \}/);
  assert.doesNotMatch(editorial, /\.footer-base\s*\{[^}]*font-family:\s*var\(--mono\)/);
  assert.doesNotMatch(editorial, /\.category-index-list em\s*\{[^}]*font-family:\s*var\(--mono\)/);
  assert.doesNotMatch(editorial, /\.filter-group > button > em\s*\{[^}]*font-family:\s*var\(--mono\)/);
  assert.doesNotMatch(editorial, /\.catalog-result-heading p strong\s*\{[^}]*font-family:\s*var\(--mono\)/);
  assert.doesNotMatch(routes, /\.interest-message blockquote footer\s*\{[^}]*font-family:\s*var\(--mono\)/);
  assert.doesNotMatch(routes, /\.page-folio\s*\{[^}]*font-family:\s*var\(--mono\)/);
  assert.doesNotMatch(routes, /\.bprs-marquee-count\s*\{[^}]*font-family:\s*var\(--mono\)/);
  assert.doesNotMatch(routes, /\.bprs-result-summary strong\s*\{[^}]*font-family:\s*var\(--mono\)/);
  assert.doesNotMatch(publicStyles, /--icon-normal/);
  assert.doesNotMatch(publicStyles, /#5145e8|#3d31c8|#eae7ff|#aaa2ff|#d9d6ff/i);
  assert.match(siteHeader, /aria-current=\{isActive\(item\.href\)/);
  assert.match(siteHeader, /weight=\{active \? "bold" : "regular"\}/);
  assert.match(packageJson, /"@phosphor-icons\/react"/);
  assert.doesNotMatch(packageJson, /lucide/i);
});

test("shell publik mengunci identitas, header adaptif, navigasi mobile, dan hubungan produk di footer", async () => {
  const [brandLockup, siteHeader, siteFooter, globals, editorial, designSystem, response] = await Promise.all([
    readFile(new URL("../app/components/BrandLockup.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/SiteHeader.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/SiteFooter.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/editorial.css", import.meta.url), "utf8"),
    readFile(new URL("../app/design-system.css", import.meta.url), "utf8"),
    render("/"),
  ]);
  const styles = `${globals}\n${editorial}\n${designSystem}`;

  assert.match(brandLockup, /aria-label="Seputarjaminan by ruwang, kembali ke beranda"/);
  assert.match(brandLockup, /<span>by<\/span>[\s\S]*>ruwang<\/span>/);
  assert.match(brandLockup, /<span>seputar<\/span>[\s\S]*<strong>jaminan<\/strong>/);
  assert.match(siteHeader, /window\.scrollY > 28/);
  assert.match(siteHeader, /window\.requestAnimationFrame\(updateHeader\)/);
  assert.match(siteHeader, /site-header\$\{compact \? " is-compact"/);
  assert.match(siteHeader, /href === "\/katalog" && pathname\.startsWith\("\/aset\/"\)/);
  assert.match(siteHeader, /Katalog publik dari BPRS melalui ruwang\./);
  assert.match(globals, /\.site-header\.is-compact \.header-inner \{ min-height: 68px; \}/);
  assert.match(globals, /\.desktop-nav a \{[^}]*min-height: 44px/);
  assert.match(globals, /\.header-cta \{[^}]*min-height: 44px/);
  assert.match(globals, /mobileNavigationIn/);
  assert.match(globals, /\.mobile-navigation-head > button \{[^}]*width: 48px; height: 48px/);
  assert.match(globals, /\.mobile-navigation-head > button:focus-visible \{ border-radius: 50%; box-shadow: 0 0 0 2px var\(--color-inverse-accent\); \}/);
  assert.match(globals, /\.mobile-navigation nav a:focus-visible \{ box-shadow: inset 3px 0 0 var\(--color-inverse-accent\); \}/);
  assert.match(globals, /\.mobile-menu-trigger:focus-visible \{ outline: none; border-radius: 50%; box-shadow: 0 0 0 2px var\(--iris\); \}/);
  assert.match(designSystem, /\.mobile-navigation nav a \{\s*opacity: 1;\s*transform: none;/);
  assert.match(siteFooter, /Seputarjaminan/);
  assert.match(siteFooter, /Informasi lanjutan melalui BPRS pada detail aset\./);
  assert.doesNotMatch(styles, /#5145e8|#3d31c8|#eae7ff|#aaa2ff|#d9d6ff/i);

  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Seputar Jaminan by ruwang/);
  const footerHtml = html.match(/<footer[\s\S]*?<\/footer>/)?.[0];
  assert.ok(footerHtml);
  assert.match(footerHtml, /Seputarjaminan by ruwang, kembali ke beranda/);
  assert.match(footerHtml, /Informasi lanjutan melalui BPRS pada detail aset\./);
  assert.doesNotMatch(footerHtml, /<svg|<small|Layanan katalog publik|footer-identity-line/);
  for (const href of ["/katalog", "/bprs", "/cara-minat"]) assert.ok(footerHtml.includes(`href="${href}"`));
});

test("homepage menjaga kontrol carousel, rail BPRS adaptif, komposisi aset, dan alur ringkas", async () => {
  const [page, hero, bprsMarquee, globals, editorial, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/HeroAssetCarousel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/BprsMarquee.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/editorial.css", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(hero, /loop: interactive/);
  assert.match(hero, /const interactive = slides\.length > 1/);
  assert.match(hero, /event\.key === "ArrowLeft"/);
  assert.match(hero, /event\.key === "ArrowRight"/);
  assert.match(hero, /Jeda carousel/);
  assert.match(hero, /Putar carousel/);
  assert.match(hero, /visibilitychange/);
  assert.match(hero, /IntersectionObserver/);
  assert.match(globals, /\.hero-showcase\.is-single \.hero-slide \{ flex-basis: 100%; border-right: 0; \}/);

  const marqueeStyles = await readFile(new URL("../app/components/BprsMarquee.module.css", import.meta.url), "utf8");
  assert.match(bprsMarquee, /profiles\.length === 0/);
  assert.match(bprsMarquee, /data-layout=\{rail \? "rail" : "static"\} data-direction="right"/);
  assert.match(bprsMarquee, /aria-hidden=\{group === 1 \|\| undefined\}/);
  assert.match(bprsMarquee, /tabIndex=\{group === 1 \? -1 : undefined\}/);
  assert.match(bprsMarquee, /width >= viewport.clientWidth/);
  assert.match(bprsMarquee, /ResizeObserver/);
  assert.doesNotMatch(bprsMarquee, /Math.ceil\(6/);
  assert.match(bprsMarquee, /Jeda animasi logo/);
  assert.match(marqueeStyles, /animation: drift var\(--marquee-duration\) linear infinite/);
  assert.match(marqueeStyles, /:focus-within \.viewport \.track/);
  assert.match(marqueeStyles, /prefers-reduced-motion: reduce/);

  assert.match(page, /const latestAssets = assets\.slice\(0, 3\)/);
  assert.match(page, /data-count=\{latestAssets\.length\}/);
  assert.match(page, /href=\{`\/katalog\?category=\$\{category\.slug\}`\}/);
  assert.match(editorial, /\.home-asset-grid--count-1/);
  assert.match(editorial, /\.home-asset-grid--count-2/);
  assert.match(editorial, /\.home-process-list/);
  assert.match(page, /Cari aset/);
  assert.match(page, /Baca detail/);
  assert.match(page, /Hubungi BPRS/);
  assert.doesNotMatch(page, /Admin BPRS|web internal|category-index|market-search/);
  // Streamed client-component HTML may sit outside the initial main boundary.
  const html = (await (await render("/")).text()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "");
  assert.equal((html.match(/<h1 id="hero-title"/g) ?? []).length, 1); // Excludes the streamed loading fallback h1; browser checks the settled DOM.
  assert.equal((html.match(/aria-label="Kategori aset"/g) ?? []).length, 1);
  assert.match(html, /<form(?=[^>]*action="\/katalog")(?=[^>]*role="search")/);
  assert.match(html, /name="q"/);
  assert.match(html, /Lihat agunan dari BPRS, kenali detailnya, lalu hubungi BPRS melalui WhatsApp/);
  for (const slug of ["tanah", "bangunan", "mesin-peralatan", "kendaraan"]) {
    assert.equal((html.match(new RegExp('href="/katalog\\?category=' + slug + '"', 'g')) ?? []).length, 1);
  }
  assert.ok(html.indexOf('data-home-section="hero"') < html.indexOf('data-home-section="bprs"'));
  assert.ok(html.indexOf('data-home-section="bprs"') < html.indexOf('data-home-section="latest"'));
  assert.ok(html.indexOf('data-home-section="latest"') < html.indexOf('data-home-section="guide"'));
  assert.match(page, /href="\/cara-minat"/);
  assert.match(packageJson, /"embla-carousel-react"/);
});

test("homepage merender state 0, 1, 2, dan banyak data tanpa fallback produksi", async () => {
  const originalAssetCount = fixtureAssetCount;
  const originalInstitutionCount = fixtureInstitutionCount;
  try {
    fixtureAssetCount = 1;
    fixtureInstitutionCount = 1;
    let response = await render("/");
    let html = await response.text();
    assert.match(html, /data-count="1"/);
    assert.match(html, /data-layout="single"/);
    assert.doesNotMatch(html, /aria-label="Aset sebelumnya"|aria-label="Aset berikutnya"/);
    assert.doesNotMatch(html, /aria-label="Jeda animasi logo"/);

    fixtureAssetCount = 2;
    fixtureInstitutionCount = 3;
    response = await render("/");
    html = await response.text();
    assert.match(html, /data-count="2"/);
    assert.match(html, /data-layout="static"/); // SSR is static until actual viewport capacity is known.
    assert.match(html, /aria-label="Aset sebelumnya"/);
    assert.match(html, /aria-label="Aset berikutnya"/);
    assert.doesNotMatch(html, /aria-label="Jeda animasi logo"/);

    fixtureAssetCount = 5;
    fixtureInstitutionCount = 5;
    response = await render("/");
    html = await response.text();
    assert.match(html, /data-count="3"/);
    assert.match(html, /data-layout="static"/);
    assert.match(html, /data-direction="right"/);
    assert.doesNotMatch(html, /data-direction="left"/);
    assert.match(html, /<ul class="[^"]+" aria-hidden="true"/);

    fixtureAssetCount = 0;
    fixtureInstitutionCount = 0;
    response = await render("/");
    html = await response.text();
    assert.match(html, /Belum ada aset yang diterbitkan/);
    assert.match(html, /Belum ada BPRS dengan aset yang tersedia/);
    assert.doesNotMatch(html, /home-asset-carousel|data-asset-card=/);
    assert.match(html, /name="q"/);
    assert.match(html, /aria-label="Kategori aset"/);
    assert.doesNotMatch(html, /images\.unsplash/i);
  } finally {
    fixtureAssetCount = originalAssetCount;
    fixtureInstitutionCount = originalInstitutionCount;
  }
});

test("katalog mengunci filter sementara, jumlah halaman, dan konteks URL", async () => {
  const page = await readFile(new URL("../app/katalog/page.tsx", import.meta.url), "utf8");
  const client = await readFile(new URL("../app/components/CatalogClient.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/katalog/catalog.module.css", import.meta.url), "utf8");
  assert.match(page, /<h1>Katalog aset/);
  assert.doesNotMatch(page, /PageIntro|publishers.map.*province/);
  assert.match(client, /Pilihan belum diterapkan/);
  assert.match(client, /Tampilkan hasil/);
  assert.doesNotMatch(client, /Tampilkan \$\{items.length\} aset|draftMatchesApplied/);
  assert.match(client, /Saran dari aset pada halaman ini/);
  assert.match(client, /data-mode=\{mode\}/);
  assert.match(client, /catalogReturn=\{catalogUrl\}/);
  assert.match(client, /restoreCatalogPosition/);
  assert.match(css, /max-width: 450px/);
  const html = (await (await render("/katalog?q=rumah&category=bangunan&province=Jawa%20Barat&bprs=bprs-amanah-nasional&sort=terlama")).text()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,"");
  assert.match(html, /Filter aktif/);
  for (const label of ["Hapus Pencarian: rumah", "Hapus Jenis: Bangunan", "Hapus Provinsi: Jawa Barat", "Hapus BPRS: BPRS Amanah Nasional"]) assert.ok(html.includes(label));
  assert.match(html, /aset ditampilkan pada halaman ini/);
  assert.doesNotMatch(html, /filter harga|jadwal lelang/i);
  const hrefs=[...html.matchAll(/href="([^"]*returnTo=[^"]*)"/g)].map(m=>m[1].replaceAll("&amp;","&"));
  assert.equal(hrefs.length,3);
  assert.equal(new Set(hrefs).size,1);
  const detailUrl=new URL(hrefs[0],"http://local");
  assert.equal(detailUrl.pathname,"/aset/sj-test0001");
  const back=detailUrl.searchParams.get("returnTo");
  assert.match(back,/q=rumah/); assert.match(back,/sort=terlama/);
  const detailHtml=await (await render(detailUrl.pathname+detailUrl.search)).text();
  assert.ok(detailHtml.includes('href="'+back.replaceAll("&","&amp;")+'"'));
  const unsafe=await (await render("/aset/sj-test0001?returnTo=https%3A%2F%2Fevil.example")).text();
  assert.match(unsafe, /class="asset-detail-back" href="\/katalog"/);
});

test("katalog merender jumlah halaman dan tombol hapus hanya ketika pencarian berisi", async () => {
  let response = await render("/katalog");
  assert.equal(response.status, 200);
  let html = await response.text();
  assert.match(html, /aset ditampilkan pada halaman ini/);
  assert.match(html, /Cari aset atau lokasi/);
  assert.doesNotMatch(html, /aria-label="Hapus pencarian"/);
  assert.doesNotMatch(html, />AKTIF</);

  response = await render("/katalog?q=rumah");
  assert.equal(response.status, 200);
  html = await response.text();
  assert.match(html, /aria-label="Hapus pencarian"/);
  assert.match(html, /value="rumah"/);
  assert.doesNotMatch(html, /images\.unsplash/i);
});

test("kartu aset mengunci data nyata, aksi selalu terlihat, dan interaksi terpisah", async () => {
  const originalAssetCount = fixtureAssetCount;
  let response;
  try {
    fixtureAssetCount = 1;
    response = await render("/katalog");
  } finally {
    fixtureAssetCount = originalAssetCount;
  }
  const [assetCard, catalogData, publicApi, publicService, openApi, editorial] = await Promise.all([
    readFile(new URL("../app/components/AssetCard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/data/catalog.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/public-api.ts", import.meta.url), "utf8"),
    readFile(new URL("../apps/api/src/public-service.ts", import.meta.url), "utf8"),
    readFile(new URL("../packages/contracts/openapi/openapi.v1.yaml", import.meta.url), "utf8"),
    readFile(new URL("../app/editorial.css", import.meta.url), "utf8"),
  ]);

  assert.match(openApi, /availability, photo_count, public_updated_at/);
  assert.match(publicService, /photo_count: publication\.media\.length/);
  assert.match(publicApi, /Jumlah foto aset tidak sesuai kontrak publik/);
  assert.match(catalogData, /photoCount: card\.photo_count/);
  assert.match(assetCard, /data-asset-card=\{variant\}/);
  assert.match(assetCard, /\{asset\.photoCount\} foto/);
  assert.match(assetCard, /href=\{`\/bprs\/\$\{asset\.publisher\.slug\}`\}/);
  assert.match(assetCard, /<BprsMark profile=\{asset\.publisher\}/);
  assert.match(assetCard, /<Link className="ui-text-link" href=\{detailHref\}/);
  assert.match(editorial, /\.asset-card:hover \.asset-card-image img \{ transform: scale\(1\.012\); \}/);
  assert.match(editorial, /\.asset-detail-cta \{[^}]*border-bottom: 1px solid currentColor/);
  assert.doesNotMatch(assetCard, /asset-quick-view|AssetDossier|quickView/);

  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /SJ-TEST0001/);
  assert.match(html.replaceAll("<!-- -->", ""), /1 foto/);
  assert.match(html, /Bangunan/);
  assert.match(html, /Rumah/);
  assert.match(html, /Rumah tinggal dekat pusat kota/);
  assert.match(html, /Bandung/);
  assert.match(html, /Jawa Barat/);
  assert.match(html, /Diterbitkan oleh/);
  assert.match(html, /BPRS Amanah Nasional/);
  assert.match(html, /Tersedia/);
  assert.match(html, /Lihat detail/);
  assert.doesNotMatch(html, /Lihat ringkas/);
  assert.match(html, /href="\/aset\/sj-test0001\?returnTo=%2Fkatalog"/);
  assert.match(html, /href="\/bprs\/bprs-amanah-nasional"/);
});

test("komponen dossier legacy dipertahankan tanpa menjadi alur kartu publik", async () => {
  const [assetDossier, editorial] = await Promise.all([
    readFile(new URL("../app/components/AssetDossier.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/editorial.css", import.meta.url), "utf8"),
  ]);

  assert.match(assetDossier, /detail\?\.specs\.slice\(0, 5\)/);
  assert.doesNotMatch(await readFile(new URL("../app/components/AssetCard.tsx", import.meta.url), "utf8"), /import .*AssetDossier/);
  assert.match(assetDossier, /className=\{`dossier-gallery \$\{gallery\.length > 1 \? "has-filmstrip" : "is-single"\}`\}/);
  assert.match(assetDossier, /className="dossier-scroll"/);
  assert.match(assetDossier, /className="dossier-toolbar-context"/);
  assert.match(assetDossier, /className="dossier-toolbar-actions"/);
  assert.match(assetDossier, /className="dossier-mobile-action"/);
  assert.match(assetDossier, /<Dialog\.Title className="dossier-title">/);
  assert.match(assetDossier, /<Dialog\.Description id=\{`dossier-description-/);
  assert.match(assetDossier, /onCloseAutoFocus/);
  assert.match(assetDossier, /returnFocusRef\.current\?\.focus\(\)/);
  assert.match(assetDossier, /aria-label="Tutup detail aset"/);
  assert.match(assetDossier, /className="dossier-detail-link"/);
  assert.doesNotMatch(assetDossier, /detail\.specs\.map/);
  assert.doesNotMatch(assetDossier, /ArrowSquareOut/);

  assert.match(editorial, /\.dossier \{[^}]*grid-template-columns: minmax\(0,3fr\) minmax\(420px,2fr\)/);
  assert.match(editorial, /\.dossier-information \{[^}]*display: grid;[^}]*grid-template-rows: auto minmax\(0,1fr\);[^}]*overflow: hidden/);
  assert.match(editorial, /\.dossier-toolbar \{[^}]*position: sticky;[^}]*top: 0/);
  assert.match(editorial, /\.dossier-scroll \{[^}]*overflow-y: auto;[^}]*scrollbar-color: var\(--iris\)/);
  assert.match(editorial, /\.dossier-scroll::-webkit-scrollbar-thumb \{ background: var\(--iris\); \}/);
  assert.match(editorial, /\.dossier-photo-arrows button \{[^}]*background: transparent/);
  assert.match(editorial, /\.dossier-whatsapp \{[^}]*background: var\(--color-action\)/);
  assert.match(editorial, /\.dossier-mobile-action \{ display: none; \}/);
  assert.match(editorial, /@media \(max-width: 920px\)[\s\S]*\.dossier \{[^}]*width: 100vw;[^}]*height: 100dvh/);
  assert.match(editorial, /@media \(max-width: 920px\)[\s\S]*\.dossier-information \{[^}]*grid-template-rows: auto minmax\(0,1fr\) auto/);
  assert.match(editorial, /@media \(max-width: 920px\)[\s\S]*\.dossier-mobile-action \{ display: block/);
  assert.match(editorial, /\.dossier-whatsapp-desktop \{ display: none; \}/);
});

test("detail aset mengunci urutan informasi, PhotoSwipe lazy-load, dan CTA mobile tetap", async () => {
  const [page, gallery, routes, layout, packageJson, detailStyles, contact, contactStyles] = await Promise.all([
    readFile(new URL("../app/aset/[slug]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/AssetDetailGallery.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/routes.css", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../app/aset/[slug]/detail.module.css", import.meta.url), "utf8"),
    readFile(new URL("../app/components/AssetContact.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/AssetContact.module.css", import.meta.url), "utf8"),
  ]);

  const orderedSections = [
    "<CatalogReturnLink returnTo={returnTo}",
    "<header className={styles.heading}",
    "<AssetDetailGallery",
    "<AssetContact configuredUrl",
    "asset-specification-heading",
    "asset-description-heading",
    "related-assets",
  ].map((needle) => page.indexOf(needle));
  assert.ok(orderedSections.every((position) => position >= 0));
  assert.ok(orderedSections.every((position, index) => index === 0 || position > orderedSections[index - 1]));
  assert.match(page, /<AssetContact mobile configuredUrl=\{asset.whatsappUrl\}/);
  assert.match(contact, /Hubungi BPRS/);
  assert.match(page, /Konfirmasikan ketersediaan, dokumen, dan proses berikutnya/);
  assert.match(page, /<StatusBadge>\{asset.status\}<\/StatusBadge>/);
  assert.doesNotMatch(page, /SealCheck/);
  assert.match(detailStyles, /flex-direction: column/);
  assert.match(contactStyles, /env\(safe-area-inset-bottom\)/);
  assert.match(contact, /new ResizeObserver/);
  assert.doesNotMatch(page, /Rp\s?[0-9]|asset-price|price-display/i);

  assert.match(gallery, /new PhotoSwipeLightbox/);
  assert.match(gallery, /pswpModule: \(\) => import\("photoswipe"\)/);
  assert.match(gallery, /data-pswp-width=\{image\.width\}/);
  assert.match(gallery, /data-pswp-height=\{image\.height\}/);
  assert.match(gallery, /href=\{image\.url\}/);
  assert.match(gallery, /target="_blank"/);
  assert.match(gallery, /wheelToZoom: true/);
  assert.match(gallery, /maxZoomLevel: 3/);
  assert.match(gallery, /arrowPrevSVG: phosphorArrowLeftSvg/);
  assert.match(gallery, /arrowNextSVG: phosphorArrowRightSvg/);
  assert.match(gallery, /closeSVG: phosphorCloseSvg/);
  assert.match(gallery, /zoomSVG: phosphorZoomSvg/);
  assert.match(gallery, /viewBox="0 0 256 256"/);
  assert.match(gallery, /lightbox\.on\("closingAnimationEnd"/);
  assert.match(gallery, /focus\(\{ preventScroll: true \}\)/);
  assert.match(gallery, /images\.length > 1 &&/);
  assert.match(gallery, /aria-pressed=\{index === activeIndex\}/);
  assert.doesNotMatch(gallery, /MediaLightbox/);

  assert.match(routes, /\.asset-gallery-thumbnails \{[^}]*overflow-x: auto;[^}]*scrollbar-color: var\(--iris\)/);
  assert.match(routes, /\.asset-gallery-arrows button \{[^}]*background: transparent/);
  assert.match(routes, /\.asset-detail-editorial \.asset-detail-information \{[^}]*animation: none/);
  assert.match(routes, /\.asset-mobile-whatsapp \{ display: none; \}/);
  assert.match(routes, /@media \(max-width: 620px\)[\s\S]*\.asset-mobile-whatsapp \{[^}]*position: fixed;[^}]*bottom: max\(10px,env\(safe-area-inset-bottom\)\);[^}]*background: var\(--color-action\)/);
  assert.match(routes, /\.sj-photoswipe \{ --pswp-bg: var\(--color-media-canvas\); \}/);
  assert.match(layout, /import "photoswipe\/style\.css"/);
  assert.match(packageJson, /"photoswipe": "5\.4\.4"/);
});

test("detail aset merender state satu dan banyak foto tanpa navigasi palsu", async () => {
  const originalMediaCount = fixtureMediaCount;
  try {
    fixtureMediaCount = 1;
    const singleResponse = await render("/aset/sj-test0001");
    assert.equal(singleResponse.status, 200);
    const singleHtml = await singleResponse.text();
    assert.match(singleHtml, /Buka foto 1 dari 1 pada layar penuh/);
    assert.doesNotMatch(singleHtml, /Foto sebelumnya|Pilih sudut foto|Tampilkan foto 2/);

    fixtureMediaCount = 3;
    const multipleResponse = await render("/aset/sj-test0001");
    assert.equal(multipleResponse.status, 200);
    const multipleHtml = await multipleResponse.text();
    assert.match(multipleHtml, /Foto sebelumnya/);
    assert.match(multipleHtml, /Foto berikutnya/);
    assert.match(multipleHtml, /Pilih sudut foto/);
    assert.match(multipleHtml, /Tampilkan foto 3/);
    assert.match(multipleHtml, /data-pswp-width="1600"/);
    assert.match(multipleHtml, /data-pswp-height="1200"/);
  } finally {
    fixtureMediaCount = originalMediaCount;
  }
});

test("WhatsApp mempertahankan nomor publikasi dan menyertakan identitas serta URL lingkungan tanpa query internal", () => {
  const title = "Rumah A & B / usaha? #1 — Bandung";
  for (const origin of ["http://127.0.0.1:4411", "https://seputarjaminan.ruwangarsip.com"]) {
    const href = assetWhatsappHref(fixtureDetail.whatsapp_url, title, fixtureCard.reference_code, origin);
    const parsed = new URL(href);
    assert.equal(parsed.origin + parsed.pathname, "https://wa.me/628111111111");
    assert.equal(parsed.searchParams.get("text"), `Halo Bapak/Ibu, saya ingin mengetahui informasi lebih lanjut tentang ${title} (SJ-TEST0001).\n${origin}/aset/sj-test0001`);
    assert.deepEqual([...parsed.searchParams.keys()], ["text"]);
  }
  for (const invalid of [null, undefined, "", "https://example.org/628111111111", "javascript:alert(1)", "http://wa.me/628111111111", "https://wa.me.evil.test/628111111111", "https://wa.me@evil.test/628111111111", "https://user@wa.me/628111111111", "https://wa.me/08111111111", "https://wa.me/+628111111111", "https://wa.me/123", "https://wa.me/1234567890123456", "https://wa.me/628111111111/extra", "https://wa.me/628111111111#x"]) {
    assert.equal(publicationWhatsappDestination(invalid), null, String(invalid));
    assert.equal(assetWhatsappHref(invalid, title, fixtureCard.reference_code, "https://public.test"), null);
  }
  assert.equal(assetWhatsappHref(fixtureDetail.whatsapp_url, title, "../bad", "https://public.test"), null);
  assert.equal(assetWhatsappHref(fixtureDetail.whatsapp_url, title, fixtureCard.reference_code, "file:///test"), null);
});

test("detail parsial, kontak rusak, kontak hilang, dan status nonpublik tidak menghasilkan CTA palsu", async () => {
  try {
    fixtureDetailVariant = "partial";
    const partial = await (await render("/aset/sj-test0001")).text();
    assert.match(partial, /Tentang aset/);
    assert.doesNotMatch(partial, /id="asset-specification-heading"/);
    fixtureDetailVariant = "invalid-wa";
    const invalid = await (await render("/aset/sj-test0001")).text();
    assert.match(invalid, /Kontak belum tersedia/);
    assert.match(invalid, /Tautan WhatsApp publikasi ini belum valid/);
    assert.doesNotMatch(invalid, /href="https:\/\/(wa\.me|example.org)/);
    for (const variant of ["missing-wa", "invalid-status"]) {
      fixtureDetailVariant = variant;
      const html = await (await render("/aset/sj-test0001")).text();
      assert.match(html, /Detail aset belum dapat dimuat/);
      assert.doesNotMatch(html, /href="https:\/\/wa.me/);
    }
    fixtureDetailVariant = "inactive";
    const html = await (await render("/aset/sj-test0001")).text();
    assert.match(html, /noindex/);
    assert.doesNotMatch(html, /id="asset-title"|href="https:\/\/wa.me/);
  } finally { fixtureDetailVariant = "normal"; }
});

test("direktori BPRS mengunci hierarki ringkas, adaptasi jumlah, dan field publik", async () => {
  const [directoryPage, directory, profilePage, assetCard, directoryStyles, publicService] = await Promise.all([
    readFile(new URL("../app/bprs/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/BprsDirectory.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/bprs/[slug]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/AssetCard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/bprs/bprs.module.css", import.meta.url), "utf8"),
    readFile(new URL("../apps/api/src/public-service.ts", import.meta.url), "utf8"),
  ]);

  assert.match(directoryPage, /BPRS dengan aset yang tersedia di katalog Seputarjaminan/);
  assert.match(directoryPage, /currentCursor=\{cursor\}/);
  assert.match(directory, /const SEARCH_THRESHOLD = 8/);
  assert.match(directory, /profiles\.length >= SEARCH_THRESHOLD/);
  assert.match(directory, /action="\/bprs" method="get"/);
  assert.match(directory, /BPRS pada halaman ini/);
  assert.match(directory, /Number\.isSafeInteger\(profile\.publishedAssetCount\)/);
  assert.match(directory, /data-bprs-list/);
  assert.match(directory, /Kembali ke halaman pertama/);
  assert.match(profilePage, /styles\.profileLogo/);
  assert.match(profilePage, /styles\.profileHeader/);
  assert.match(profilePage, /<AssetCard/);
  assert.match(profilePage, /assetsResult\.value\.next_cursor/);
  assert.match(profilePage, /Lihat aset berikutnya/);
  assert.match(profilePage, /Belum ada aset tersedia dari BPRS ini/);
  assert.doesNotMatch(profilePage + directoryPage + directory, /SealCheck|ShieldCheck|terverifikasi|seluruh BPRS Indonesia/);
  assert.doesNotMatch(profilePage, /showPublisher=\{false\}/);
  assert.match(assetCard, /showPublisher = true/);
  assert.match(directoryStyles, /max-width: 960px/);
  assert.match(directoryStyles, /max-width: 450px/);
  assert.match(directoryStyles, /background: var\(--color-logo-surface\)/);
  assert.match(directoryStyles, /prefers-reduced-motion/);

  const institutionListMapping = publicService.slice(
    publicService.indexOf("items: items.map((institution)"),
    publicService.indexOf("next_cursor:", publicService.indexOf("items: items.map((institution)")),
  );
  assert.match(institutionListMapping, /public_slug/);
  assert.match(institutionListMapping, /public_name/);
  assert.match(institutionListMapping, /public_mark_url/);
  assert.match(institutionListMapping, /short_description/);
  assert.match(institutionListMapping, /office_city_regency/);
  assert.match(institutionListMapping, /office_province/);
  assert.match(institutionListMapping, /published_asset_count/);
  assert.doesNotMatch(institutionListMapping, /phone|whatsapp|address|tenant|user|email/i);
});

test("direktori dan profil BPRS merender state kosong, satu, beberapa, dan banyak", async () => {
  const originalAssetCount = fixtureAssetCount;
  const originalInstitutionCount = fixtureInstitutionCount;
  try {
    fixtureAssetCount = 1;
    fixtureInstitutionCount = 1;
    let response = await render("/bprs");
    assert.equal(response.status, 200);
    let html = await response.text();
    assert.match(html, /BPRS dengan aset yang tersedia/);
    assert.match(html, /data-bprs-list/);
    assert.doesNotMatch(html, /role="search"/);

    fixtureInstitutionCount = 5;
    response = await render("/bprs");
    assert.equal(response.status, 200);
    html = await response.text();
    assert.match(html, /data-bprs-list/);
    assert.match(html, /BPRS Utama Nusantara/);
    assert.doesNotMatch(html, /role="search"/);

    fixtureInstitutionCount = 9;
    response = await render("/bprs");
    assert.equal(response.status, 200);
    html = await response.text();
    assert.match(html, /role="search"/);
    assert.match(html, /Cari BPRS atau wilayah/);
    assert.match(html, /BPRS Harmoni Sulawesi/);

    response = await render("/bprs?q=nama-yang-tidak-ada");
    assert.equal(response.status, 200);
    html = await response.text();
    assert.match(html, /Belum ada BPRS yang cocok/);
    assert.match(html, /Tampilkan semua BPRS/);
    assert.match(html, /value="nama-yang-tidak-ada"/);

    fixtureInstitutionCount = 0;
    response = await render("/bprs");
    assert.equal(response.status, 200);
    html = await response.text();
    assert.match(html, /Belum ada BPRS dengan aset tersedia/);
    assert.doesNotMatch(html, /role="search"/);

    fixtureAssetCount = 0;
    fixtureInstitutionCount = 1;
    response = await render("/bprs/bprs-amanah-nasional");
    assert.equal(response.status, 200);
    html = await response.text();
    assert.match(html, /Belum ada aset tersedia dari BPRS ini/);
    assert.match(html, /aria-label="0 aset tersedia"/);
    assert.doesNotMatch(html, /class="asset-card/);

    fixtureAssetCount = 1;
    response = await render("/bprs/bprs-amanah-nasional");
    assert.equal(response.status, 200);
    html = await response.text();
    assert.match(html, /data-bprs-assets/);
    assert.match(html, /Rumah tinggal dekat pusat kota/);
    assert.match(html, /Diterbitkan oleh/); // Stage 3 cards retain publisher identity on profile pages too.
    assert.doesNotMatch(html, /alamat lengkap|nomor telepon|email/i);
  } finally {
    fixtureAssetCount = originalAssetCount;
    fixtureInstitutionCount = originalInstitutionCount;
  }
});

test("panduan ringkas tiga langkah tanpa klaim verifikasi atau kontak internal", async () => {
  const journey = await readFile(new URL("../app/components/InterestJourney.tsx", import.meta.url), "utf8");
  const page = await readFile(new URL("../app/cara-minat/page.tsx", import.meta.url), "utf8");
  assert.match(journey, /title: "Cari aset"/);
  assert.match(journey, /title: "Baca detail"/);
  assert.match(journey, /title: "Hubungi BPRS"/);
  assert.match(journey, /kontak yang ditentukan BPRS untuk aset tersebut/);
  assert.match(journey, /Anda dapat mengeditnya sebelum mengirim/);
  assert.match(page, /Tombol hanya membuka WhatsApp dengan draf pesan/);
  assert.doesNotMatch(page + journey, /ShieldCheck|SealCheck|marketing|terverifikasi|diverifikasi|backend/);
});

test("BPRS pagination, profil parsial, dan error memiliki tujuan publik yang benar", async () => {
  let html = await (await render("/bprs?q=__pagination__")).text();
  assert.match(html, /href="\/bprs\?q=__pagination__&amp;cursor=fixture-bprs-page-2"/);
  html = await (await render("/bprs?q=__pagination__&cursor=fixture-bprs-page-2")).text();
  assert.match(html, /Kembali ke halaman pertama/);
  assert.match(html, /value="__pagination__"/);
  html = await (await render("/bprs/bprs-test-paginated")).text();
  assert.match(html, /aria-label="5 aset tersedia"/);
  assert.equal((html.match(/data-asset-card="catalog"/g) ?? []).length, 2);
  assert.match(html, /href="\/katalog\?bprs=bprs-test-paginated&amp;cursor=fixture-profile-page-2"/);
  html = await (await render("/bprs/bprs-test-assets-error")).text();
  assert.match(html, /BPRS Amanah Nasional/);
  assert.match(html, /Aset BPRS belum dapat dimuat/);
  assert.doesNotMatch(html, /data-asset-card="catalog"|Belum ada aset tersedia/);
  html = await (await render("/bprs?q=__api-failure__")).text();
  assert.match(html, /Direktori BPRS belum dapat dimuat/);
  assert.doesNotMatch(html, /data-bprs-list|BPRS pada halaman ini/);
});

test("halaman Cara menghubungi merender tiga langkah dan dua FAQ tanpa nomor WhatsApp", async () => {
  const response = await render("/cara-minat");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Cara menghubungi/);
  assert.match(html, /Cari aset/);
  assert.match(html, /Baca detail/);
  assert.match(html, /Hubungi BPRS/);
  assert.match(html, /Nama, kode, dan tautan aset ikut dalam pesan/);
  assert.match(html, /href="\/katalog"/);
  assert.match(html, /href="\/bprs"/);
  assert.equal((html.match(/<details>/g) ?? []).length, 2);
  assert.equal((html.match(/<li>/g) ?? []).length, 3);
  // Build asset hashes can contain digit sequences resembling phone numbers.
  // Check phone numbers in page text, and contact links separately in markup.
  const text = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ");
  assert.doesNotMatch(text, /(?:\+?62|0)8\d{7,}|marketing|diverifikasi/);
  assert.doesNotMatch(html, /wa\.me|href=["'](?:tel:|https?:\/\/api\.whatsapp\.com)/i);
});

test("system state mengunci loading, empty, error, offline, timeout, media, dan 404 khusus", async () => {
  const [
    rootLoading,
    catalogLoading,
    assetLoading,
    bprsLoading,
    dataState,
    loadingState,
    connectivity,
    mediaState,
    rootNotFound,
    assetNotFound,
    bprsNotFound,
    errorBoundary,
    globalError,
    publicApi,
    catalogClient,
    systemStates,
  ] = await Promise.all([
    readFile(new URL("../app/loading.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/katalog/loading.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/aset/[slug]/loading.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/bprs/loading.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/PublicDataState.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/PublicLoadingState.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/ConnectivityNotice.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/PublicMedia.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/not-found.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/aset/[slug]/not-found.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/bprs/[slug]/not-found.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/error.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/global-error.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/public-api.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/components/CatalogClient.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/system-states.css", import.meta.url), "utf8"),
  ]);

  assert.match(rootLoading, /variant="home"/);
  assert.match(catalogLoading, /variant="catalog"/);
  assert.match(assetLoading, /variant="detail"/);
  assert.match(bprsLoading, /variant="directory"/);
  assert.match(loadingState, /Menyiapkan beranda/);
  assert.match(loadingState, /Menyiapkan katalog/);
  assert.match(loadingState, /Menyiapkan detail/);
  assert.match(loadingState, /Menyiapkan direktori/);
  assert.doesNotMatch(loadingState, /fixture|dummy|sample|Rumah tinggal/i);

  assert.match(dataState, /"empty" \| "error" \| "no-results" \| "offline" \| "timeout"/);
  assert.match(dataState, /Waktu tunggu habis/);
  assert.match(connectivity, /addEventListener\("offline"/);
  assert.match(connectivity, /Koneksi internet terputus/);
  assert.match(mediaState, /data-media-state/);
  assert.match(mediaState, /load-error/);

  assert.match(rootNotFound, /kind="general"/);
  assert.match(assetNotFound, /kind="asset"/);
  assert.match(bprsNotFound, /kind="bprs"/);
  assert.match(errorBoundary, /UnexpectedErrorPage/);
  assert.match(errorBoundary, /\{ reset \}/);
  assert.match(errorBoundary, /retry=\{reset\}/);
  assert.match(globalError, /<html lang="id" className=\{fontVariables\} suppressHydrationWarning>/);
  assert.match(globalError, /<body>/);
  assert.match(globalError, /Gangguan halaman/);
  assert.match(globalError, /\{ reset \}/);
  assert.match(globalError, /retry=\{reset\}/);

  assert.match(publicApi, /PUBLIC_API_TIMEOUT/);
  assert.match(publicApi, /publicDataStateKind/);
  assert.match(catalogClient, /Belum ada aset yang diterbitkan/);
  assert.match(catalogClient, /Tidak ada hasil pencarian/);
  assert.match(catalogClient, /hasCriteria/);

  assert.match(systemStates, /\.public-loading/);
  assert.match(systemStates, /\.connectivity-notice/);
  assert.match(systemStates, /\.unexpected-error-page/);
  assert.match(systemStates, /var\(--iris\)/);
  assert.match(systemStates, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(systemStates, /#(?:6d28d9|7c3aed|8b5cf6|a855f7)/i);
});

test("system state membedakan katalog kosong dari pencarian tanpa hasil", async () => {
  const originalAssetCount = fixtureAssetCount;
  try {
    fixtureAssetCount = 0;
    let response = await render("/katalog");
    assert.equal(response.status, 200);
    let html = await response.text();
    assert.match(html, /Belum ada aset yang diterbitkan/);
    assert.doesNotMatch(html, /Muat ulang katalog/); // Successful empty data needs no retry action.
    assert.doesNotMatch(html, /Atur ulang pencarian|Rumah tinggal dekat pusat kota/);

    response = await render("/katalog?q=tidak-ada");
    assert.equal(response.status, 200);
    html = await response.text();
    assert.match(html, /Tidak ada hasil pencarian/);
    assert.match(html, /Atur ulang pencarian/);
    assert.doesNotMatch(html, /Rumah tinggal dekat pusat kota/);
  } finally {
    fixtureAssetCount = originalAssetCount;
  }
});

test("system state merender 404 aset, BPRS, dan umum dalam bahasa Indonesia", async () => {
  const cases = [
    ["/aset/sj-unknown1", /Aset ini tidak dapat ditemukan/],
    ["/bprs/bprs-tidak-ada", /Profil BPRS ini tidak ditemukan/],
    ["/alamat-yang-tidak-ada", /Halaman ini tidak ada/],
  ];

  for (const [pathname, expected] of cases) {
    const response = await render(pathname);
    assert.ok(response.status === 200 || response.status === 404, `${pathname} mengembalikan status ${response.status}`);
    const html = await response.text();
    assert.match(html, expected);
    assert.match(html, /404/);
    assert.match(html, /aria-label="Seputarjaminan by ruwang, kembali ke beranda"/);
    assert.doesNotMatch(html, /This page could not be found|Something went wrong|404: This page/i);
  }
});

test("system state menampilkan timeout ringan tanpa aset contoh", async () => {
  const response = await render("/katalog?q=__timeout__");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Waktu tunggu habis/);
  assert.match(html, /Katalog memerlukan waktu lebih lama/);
  assert.match(html, /Pencarian dan filter Anda tetap tersimpan/);
  // Publisher filters may load independently; failed asset data must not produce cards.
  assert.doesNotMatch(html, /Rumah tinggal dekat pusat kota|data-asset-card=/);
});

test("navigasi memakai satu vocabulary publik dan kartu memiliki satu tujuan detail", async () => {
  const response = await render("/katalog");
  const html = (await response.text()).replaceAll("<!-- -->", "");
  assert.match(html, />Daftar BPRS</);
  assert.match(html, />Cara menghubungi</);
  const card = html.match(/<article[^>]*data-asset-card="catalog"[\s\S]*?<\/article>/)?.[0];
  assert.ok(card, "Kartu katalog harus ada di HTML, bukan source saja.");
  const destinations = [...card.matchAll(/href="(\/aset\/[^"]+)"/g)].map(match => match[1]);
  assert.equal(destinations.length, 3, "Foto, judul, dan CTA detail.");
  assert.equal(new Set(destinations).size, 1);
  assert.equal((card.match(/>Bangunan</g) ?? []).length, 1);
  assert.match(card, /Tersedia/);
  assert.match(card, /BPRS Amanah Nasional/);
  assert.doesNotMatch(card, /Lihat ringkas|<button|<dl/);
});

test("preview fondasi tidak mengekspos contoh komponen dalam runtime produksi", async () => {
  const response = await render("/dev/design-system");
  // Next may already have streamed the shell: not-found then uses HTTP 200 + noindex.
  assert.ok(response.status === 200 || response.status === 404);
  const html = await response.text();
  assert.match(html, /Halaman ini tidak ada/);
  assert.match(html, /noindex/);
  assert.doesNotMatch(html, /Chalk, indigo, sage\.|Komponen dasar|Pencarian contoh|DEV-PREVIEW|DEV-SHOWCASE|Komponen bersama dan keluarga kartu/);
});

for (const [pathname, pattern] of [
  ["/katalog", /Katalog aset/],
  ["/bprs", /Daftar BPRS/],
  ["/bprs/bprs-amanah-nasional", /BPRS Amanah Nasional/],
  ["/aset/sj-test0001", /Rumah tinggal dekat pusat kota/],
  ["/cara-minat", /Cara menghubungi/],
]) {
  test(`server merender ${pathname} dari sumber yang sesuai`, async () => {
    const response = await render(pathname);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, pattern);
    assert.match(html, /ruwang/);
    assert.doesNotMatch(html, /images\.unsplash/i);
  });
}

test("halaman 404 memakai shell dan bahasa visual publik", async () => {
  const response = await render("/alamat-yang-tidak-ada");
  assert.equal(response.status, 404);
  const html = await response.text();
  assert.match(html, /Halaman ini tidak ada/);
  assert.match(html, /Kembali ke beranda/);
  assert.match(html, /Buka katalog/);
  assert.match(html, /aria-label="Seputarjaminan by ruwang, kembali ke beranda"/);
});

test("kegagalan API menampilkan error nyata tanpa data fixture sebagai fallback", async () => {
  fixtureFailureMode = true;
  try {
    const response = await render("/");
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /Etalase belum dapat dimuat/);
    assert.match(html, /Aset terbaru belum dapat dimuat/);
    assert.doesNotMatch(html, /Rumah tinggal dekat pusat kota|BPRS Amanah Nasional/);
  } finally {
    fixtureFailureMode = false;
  }
});

test("menjaga metadata publik dan memastikan runtime produksi bebas scaffold dan katalog hardcoded", async () => {
  const [page, catalogData, layout, assetCard, assetDossier, publicMedia, mediaLightbox, packageJson, nextConfig, ogFile] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/data/catalog.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/AssetCard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/AssetDossier.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/PublicMedia.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/MediaLightbox.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../next.config.ts", import.meta.url), "utf8"),
    stat(new URL("../public/og-v4.png", import.meta.url)),
  ]);

  assert.match(page, /listPublicAssets/);
  assert.match(page, /HeroAssetCarousel/);
  assert.match(page, /BprsMarquee/);
  assert.doesNotMatch(catalogData, /images\.unsplash|export const assets|export const bprsProfiles/);
  assert.match(layout, /Seputar Jaminan/);
  assert.match(layout, /og-v4\.png/);
  assert.match(assetCard, /<Link className="ui-text-link" href=\{detailHref\}/);
  assert.doesNotMatch(assetCard, /quickView|Lihat ringkas|AssetDossier/);
  assert.match(assetDossier, /onCloseAutoFocus/);
  assert.match(assetDossier, /returnFocusRef\.current\?\.focus\(\)/);
  assert.match(publicMedia, /onError=\{\(\) => setState\("load-error"\)\}/);
  assert.match(publicMedia, /image\.naturalWidth !== width \|\| image\.naturalHeight !== height/);
  assert.match(publicMedia, /Keterangan foto perlu diperbaiki/);
  assert.match(mediaLightbox, /PublicMedia/);
  assert.match(packageJson, /"name": "seputarjaminan"/);
  assert.match(packageJson, /"@radix-ui\/react-dialog"/);
  assert.match(packageJson, /"embla-carousel-react"/);
  assert.match(packageJson, /"photoswipe": "5\.4\.4"/);
  assert.match(packageJson, /"next": "16\.3\.8"/);
  assert.match(packageJson, /"postinstall": "node scripts\/generate-prisma-client\.mjs"/);
  assert.doesNotMatch(packageJson, /vinext|wrangler|drizzle-kit|cloudflare/i);
  assert.match(nextConfig, /localPatterns/);
  assert.doesNotMatch(nextConfig, /remotePatterns|hostname:\s*"\*\*"/);
  assert.ok(ogFile.size > 100_000);
  await assert.rejects(access(previewRoot));
  await assert.rejects(access(new URL("../app/CatalogV2.tsx", import.meta.url)));
  await assert.rejects(access(new URL("../vite.config.ts", import.meta.url)));
  await assert.rejects(access(new URL("../worker/index.ts", import.meta.url)));
});

test("motion terarah mengunci durasi dan kebijakan reduced motion", async () => {
  const [
    layout,
    provider,
    motionContract,
    revealSection,
    homepage,
    hero,
    catalogPage,
    catalogClient,
    assetCard,
    dossier,
    gallery,
    lightbox,
    designSystem,
    editorial,
    globals,
    routes,
  ] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/PublicMotionProvider.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/public-motion.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/components/EditorialRevealSection.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/HeroAssetCarousel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/katalog/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/CatalogClient.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/AssetCard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/AssetDossier.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/AssetDetailGallery.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/MediaLightbox.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/design-system.css", import.meta.url), "utf8"),
    readFile(new URL("../app/editorial.css", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/routes.css", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /<PublicMotionProvider>/);
  assert.match(provider, /<MotionConfig/);
  assert.match(provider, /reducedMotion="user"/);
  assert.match(motionContract, /fast:\s*0\.18/);
  assert.match(motionContract, /standard:\s*0\.24/);
  assert.match(motionContract, /slow:\s*0\.4/);
  assert.match(motionContract, /whileTap:\s*reducedMotion \? undefined : \{ scale: 0\.985 \}/);
  assert.match(motionContract, /viewport:\s*\{ once: true, amount: 0\.18 \}/);
  assert.doesNotMatch(motionContract, /spring|bounce|repeat:\s*Infinity/i);

  assert.match(revealSection, /<motion\.section/);
  assert.match(revealSection, /revealOnce\(reducedMotion, delay\)/);
  // Primary home content remains visible without hydration/reveal timing.
  assert.doesNotMatch(homepage, /EditorialRevealSection/);
  assert.match(homepage, /data-home-section="latest"/);
  assert.match(homepage, /data-home-section="guide"/);
  assert.doesNotMatch(hero, /AnimatePresence/); // Caption updates immediately with the chosen asset.
  assert.match(hero, /scrollNext\(Boolean\(reducedMotion\)\)/);
  assert.match(hero, /window.clearTimeout/);
  assert.match(hero, /onFocusCapture=\{pause\}/);

  assert.doesNotMatch(catalogPage, /<CatalogClient[\s\S]*key=/);
  assert.match(catalogClient, /<CatalogSearch key=\{q\}/);
  assert.match(catalogClient, /<FilterForm key=\{catalogUrl\}/);
  assert.doesNotMatch(catalogClient, /LayoutGroup|AnimatePresence|setInterval/);
  assert.doesNotMatch(assetCard, /initial=|layoutId=/); // Static readable cards, including no-JS/reduced motion.
  assert.match(assetCard, /AssetCard\.module\.css/);

  assert.match(dossier, /duration: PUBLIC_MOTION_DURATION\.slow/);
  assert.match(dossier, /initial=\{reducedMotion \? \{ opacity: 0 \}/);
  assert.match(lightbox, /duration: PUBLIC_MOTION_DURATION\.slow/);
  assert.match(lightbox, /initial=\{reducedMotion \? \{ opacity: 0 \}/);
  assert.match(gallery, /className="asset-gallery-image-frame"/);
  assert.match(designSystem, /animation: galleryFrameIn var\(--motion-fast\)/);

  const designTokens = await readFile(new URL("../app/design-tokens.css", import.meta.url), "utf8");
  assert.match(designTokens, /--motion-fast:\s*180ms/);
  assert.match(designTokens, /--motion-standard:\s*240ms/);
  assert.match(designTokens, /--motion-slow:\s*400ms/);
  assert.doesNotMatch(`${designSystem}\n${editorial}\n${globals}\n${routes}`, /(?:440|520|560|580|600|680|700)ms/);
  assert.match(`${designSystem}\n${globals}\n${routes}`, /prefers-reduced-motion:\s*reduce/);
  assert.match(designSystem, /\.mobile-navigation nav a \{\s*opacity: 1;\s*transform: none;/);
  assert.match(routes, /\.bprs-marquee-stack\.is-rail \.bprs-marquee-track \{ width: 100%; animation: none; transform: none !important; \}/);
});

test("reflow mobile dan kontrak publik tetap terkunci", async () => {
  const [routes, publicApi, publicService, openApi] = await Promise.all([
    readFile(new URL("../app/routes.css", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/public-api.ts", import.meta.url), "utf8"),
    readFile(new URL("../apps/api/src/public-service.ts", import.meta.url), "utf8"),
    readFile(new URL("../packages/contracts/openapi/openapi.v1.yaml", import.meta.url), "utf8"),
  ]);

  assert.match(routes, /\.asset-card-folio \{ align-items: flex-start; flex-wrap: wrap; \}/);
  assert.match(routes, /@media \(max-width: 430px\) \{[\s\S]*\.bprs-profile-identity \{ grid-template-columns: minmax\(0,1fr\); \}/);
  assert.match(routes, /@media \(max-width: 430px\) \{[\s\S]*\.bprs-profile-heading \{ min-width: 0; \}/);
  assert.match(routes, /@media \(max-width: 430px\) \{[\s\S]*\.bprs-profile-stat \{ grid-column: 1; \}/);

  assert.match(publicApi, /AbortSignal\.timeout\(5_000\)/);
  assert.match(publicService, /const MESSAGE_TEMPLATE = "Siang Pak\/Bu, saya ingin mengetahui informasi lebih lanjut terkait aset \{reference_code\} — \{asset_title\}\."/);
  assert.match(openApi, /availability: \{ type: string, enum: \[AVAILABLE\] \}/);
  assert.match(openApi, /photo_count: \{ type: integer, minimum: 1, maximum: 10 \}/);
});
