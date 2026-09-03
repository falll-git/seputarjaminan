import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, readFile, stat } from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

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

function visualDetail() {
  const card = {
    ...visualCard(fixtureDetail),
    media: fixtureGalleryMedia.slice(0, fixtureMediaCount),
  };
  if (visualFixtureVariant() === "long") {
    return { ...card, description: longVisualDescription };
  }
  if (visualFixtureVariant() === "broken") {
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
    if (url.pathname === "/v1/public/assets/SJ-TEST0001") {
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
    if (url.pathname === "/v1/public/assets") {
      const category = url.searchParams.get("category");
      const institution = url.searchParams.get("institution");
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
      const filterQuery = query === "__slow__" ? undefined : query;
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
      const visible = fixtureCards.slice(0, fixtureAssetCount).map(visualCard).filter((card) => (!category || category === card.category)
        && (!institution || institution === card.institution.public_slug)
        && (!province || province.toLocaleLowerCase("id-ID") === card.location.province.toLocaleLowerCase("id-ID"))
        && (!filterQuery || JSON.stringify(card).toLocaleLowerCase("id-ID").includes(filterQuery)));
      return json(response, { items: visible, next_cursor: null });
    }
    if (url.pathname === "/v1/public/institutions") {
      const query = url.searchParams.get("q")?.toLocaleLowerCase("id-ID");
      const province = url.searchParams.get("province")?.toLocaleLowerCase("id-ID");
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
      return json(response, { items: visible, next_cursor: null });
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
  assert.match(html, /Temukan aset/);
  assert.match(html, /Dari BPRS ke pengunjung/);
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
    assert.match(html, /Belum ada BPRS penerbit aktif/);
  }
  assert.doesNotMatch(html, /127\.0\.0\.1:4100\/v1\/public\/media/i);
  assert.doesNotMatch(html, /images\.unsplash/i);
  assert.doesNotMatch(html, /Jeda carousel|Putar carousel/);
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

test("design system publik mengunci skala, cobalt, bentuk, dan Phosphor", async () => {
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
  assert.match(designSystem, /--type-display-hero:[^;]+6rem/);
  assert.match(designSystem, /--type-page-title:[^;]+4\.5rem/);
  assert.match(designSystem, /--type-body:\s*1\.0625rem/);
  assert.match(designSystem, /--type-meta:\s*0\.875rem/);
  assert.match(designSystem, /--icon-action:\s*1\.5rem/);
  assert.match(designSystem, /--icon-primary:\s*1\.875rem/);
  assert.match(designSystem, /--radius-modal:\s*0\.75rem/);
  assert.match(designSystem, /--error:\s*#a33a3a/);
  assert.match(designSystem, /input:focus-visible,[\s\S]*select:focus-visible\s*\{\s*outline: 3px solid var\(--focus-ring\);\s*outline-offset: 4px;/);
  assert.match(designSystem, /prefers-reduced-motion/);
  assert.match(globals, /--iris:\s*#176bce/);
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
  assert.match(brandLockup, /<small>by<\/small>[\s\S]*<span>ruwang<\/span>/);
  assert.match(globals, /\.brand-signature small \{[^}]*font-size: 8px/);
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
  assert.match(globals, /\.mobile-navigation-head > button:focus-visible \{ border-radius: 50%; box-shadow: 0 0 0 2px #9dc8ff; \}/);
  assert.match(globals, /\.mobile-navigation nav a:focus-visible \{ box-shadow: inset 3px 0 0 #9dc8ff; \}/);
  assert.match(globals, /\.mobile-menu-trigger:focus-visible \{ outline: none; border-radius: 50%; box-shadow: 0 0 0 2px var\(--iris\); \}/);
  assert.match(designSystem, /\.mobile-navigation nav a \{\s*opacity: 1;\s*transform: none;/);
  assert.match(siteFooter, /Seputar Jaminan/);
  assert.match(siteFooter, /Layanan katalog publik/);
  assert.match(siteFooter, /Informasi diterbitkan oleh masing-masing BPRS\./);
  assert.doesNotMatch(styles, /#5145e8|#3d31c8|#eae7ff|#aaa2ff|#d9d6ff/i);

  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Seputar Jaminan by ruwang/);
  assert.match(html, /Layanan publik ruwang/);
  assert.match(html, /Informasi diterbitkan oleh masing-masing BPRS/);
});

test("homepage mengunci carousel manual, rail BPRS adaptif, komposisi aset, dan alur ringkas", async () => {
  const [page, hero, bprsMarquee, globals, editorial, routes, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/HeroAssetCarousel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/BprsMarquee.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/editorial.css", import.meta.url), "utf8"),
    readFile(new URL("../app/routes.css", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(hero, /useEmblaCarousel\(\{ loop: false, align: "start", watchDrag: interactive \}\)/);
  assert.match(hero, /const interactive = slides\.length > 1/);
  assert.match(hero, /event\.key === "ArrowLeft"/);
  assert.match(hero, /event\.key === "ArrowRight"/);
  assert.match(hero, /\{interactive \? \(/);
  assert.match(hero, /disabled=\{!canScrollPrev\}/);
  assert.match(hero, /disabled=\{!canScrollNext\}/);
  assert.doesNotMatch(hero, /\b(?:autoplay|pause|play)\b/i);
  assert.match(globals, /\.hero-showcase\.is-single \.hero-slide \{ flex-basis: 100%; border-right: 0; \}/);

  assert.match(bprsMarquee, /profiles\.length >= 4/);
  assert.match(bprsMarquee, /rail \? <MarqueeList profiles=\{profiles\} duplicate \/> : null/);
  assert.match(bprsMarquee, /data-layout=\{rail \? "rail" : "static"\}/);
  assert.match(routes, /\.bprs-marquee-viewport\.is-rail:hover \.bprs-marquee-track/);
  assert.match(routes, /\.bprs-marquee-viewport\.is-rail:focus-within \.bprs-marquee-track/);
  assert.match(routes, /prefers-reduced-motion[\s\S]*\.bprs-marquee-viewport\.is-rail \.bprs-marquee-list\[aria-hidden="true"\] \{ display: none; \}/);

  assert.match(page, /const latestAssets = assets\.slice\(0, 3\)/);
  assert.match(page, /home-asset-grid--count-\$\{latestAssets\.length\}/);
  assert.match(page, /href=\{`\/katalog\?category=\$\{category\.slug\}`\}/);
  assert.match(editorial, /\.home-asset-grid--count-1/);
  assert.match(editorial, /\.home-asset-grid--count-2/);
  assert.match(editorial, /\.home-process-list/);
  assert.match(page, /BPRS menerbitkan melalui ruwang/);
  assert.match(page, /Pengunjung melihat tanpa akun/);
  assert.match(page, /Informasi lanjutan melalui WhatsApp/);
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
    assert.match(html, /home-asset-grid home-asset-grid--count-1/);
    assert.match(html, /data-layout="static"/);
    assert.doesNotMatch(html, /aria-label="Aset sebelumnya"|aria-label="Aset berikutnya"/);
    assert.doesNotMatch(html, /<ul class="bprs-marquee-list" aria-hidden="true"/);

    fixtureAssetCount = 2;
    fixtureInstitutionCount = 3;
    response = await render("/");
    html = await response.text();
    assert.match(html, /home-asset-grid home-asset-grid--count-2/);
    assert.match(html, /data-layout="static"/);
    assert.match(html, /aria-label="Aset sebelumnya"/);
    assert.match(html, /aria-label="Aset berikutnya"/);
    assert.doesNotMatch(html, /<ul class="bprs-marquee-list" aria-hidden="true"/);

    fixtureAssetCount = 5;
    fixtureInstitutionCount = 5;
    response = await render("/");
    html = await response.text();
    assert.match(html, /home-asset-grid home-asset-grid--count-3/);
    assert.match(html, /data-layout="rail"/);
    assert.match(html, /<ul class="bprs-marquee-list" aria-hidden="true"/);

    fixtureAssetCount = 0;
    fixtureInstitutionCount = 0;
    response = await render("/");
    html = await response.text();
    assert.match(html, /Belum ada aset yang diterbitkan/);
    assert.match(html, /Belum ada BPRS penerbit aktif/);
    assert.doesNotMatch(html, /home-asset-carousel|home-asset-grid--count-/);
    assert.doesNotMatch(html, /images\.unsplash/i);
  } finally {
    fixtureAssetCount = originalAssetCount;
    fixtureInstitutionCount = originalInstitutionCount;
  }
});

test("katalog mengunci masthead faktual, pencarian dominan, combobox, dan sheet mobile", async () => {
  const [page, catalogClient, catalogCombobox, editorial, designSystem, packageJson] = await Promise.all([
    readFile(new URL("../app/katalog/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/CatalogClient.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/CatalogCombobox.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/editorial.css", import.meta.url), "utf8"),
    readFile(new URL("../app/design-system.css", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /String\(assets\.length\)\.padStart\(2, "0"\)/);
  assert.match(page, /aset ditampilkan pada halaman ini/);
  assert.doesNotMatch(page, />AKTIF</);
  assert.match(page, /const provinces = Array\.from\(new Set/);
  assert.match(catalogClient, /Cari rumah, tanah, kendaraan, atau lokasi/);
  assert.match(catalogClient, /aria-label="Hapus pencarian"/);
  assert.match(catalogClient, /className="catalog-search-submit"/);
  assert.match(catalogClient, /<Check weight="bold" aria-hidden="true"/);
  assert.match(catalogClient, /selectedKey=\{values\.bprs\}/);
  assert.match(catalogClient, /provinceKey: string \| null/);
  assert.match(catalogClient, /selectedKey=\{values\.provinceKey\}/);
  assert.match(catalogClient, /label="Provinsi aset"/);
  assert.match(catalogClient, /filter-sheet-body/);
  assert.match(catalogClient, /filter-sheet-footer/);
  assert.match(catalogClient, /Atur ulang/);
  assert.match(catalogClient, /draftMatchesApplied \? `Tampilkan \$\{items\.length\} aset` : "Tampilkan hasil"/);
  assert.doesNotMatch(catalogClient, />Tutup filter<\/button>/);
  assert.match(catalogCombobox, /from "react-aria-components"/);
  assert.match(catalogCombobox, /useFilter\(\{ sensitivity: "base" \}\)/);
  assert.match(catalogCombobox, /const visibleOptions = useMemo/);
  assert.match(catalogCombobox, /contains\(option\.supporting \?\? "", query\)/);
  assert.match(catalogCombobox, /items=\{visibleOptions\}/);
  assert.match(catalogCombobox, /menuTrigger="focus"/);
  assert.doesNotMatch(catalogCombobox, /allowsCustomValue/);
  assert.match(catalogCombobox, /renderEmptyState/);
  assert.match(editorial, /\.catalog-search \{[^}]*min-height: 82px/);
  assert.match(editorial, /\.filter-group > button\.is-active \{[^}]*background: var\(--iris-soft\)/);
  assert.match(editorial, /\.catalog-combobox-popover\[data-entering\]/);
  assert.match(editorial, /\.catalog-combobox-popover \{[^}]*pointer-events: auto/);
  assert.match(editorial, /\.filter-sheet \{[^}]*grid-template-rows: auto minmax\(0,1fr\) auto/);
  assert.match(designSystem, /\.catalog-combobox-popover\[data-entering\]/);
  assert.match(packageJson, /"react-aria-components"/);
});

test("katalog merender jumlah halaman dan tombol hapus hanya ketika pencarian berisi", async () => {
  let response = await render("/katalog");
  assert.equal(response.status, 200);
  let html = await response.text();
  assert.match(html, /aset ditampilkan pada halaman ini/);
  assert.match(html, /Cari rumah, tanah, kendaraan, atau lokasi/);
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
  assert.match(assetCard, /className="asset-card-media-meta"/);
  assert.match(assetCard, /\{asset\.photoCount\} foto/);
  assert.match(assetCard, /className="asset-publisher-link" href=\{`\/bprs\/\$\{asset\.publisher\.slug\}`\}/);
  assert.match(assetCard, /Diperbarui \{formatPublicDate\(asset\.updatedAt\)\}/);
  assert.match(assetCard, /className="asset-quick-view"/);
  assert.match(editorial, /\.asset-card:hover \.asset-card-image img \{ transform: scale\(1\.012\); \}/);
  assert.match(editorial, /\.asset-quick-view \{[^}]*border-bottom: 1px solid var\(--ink\)/);
  assert.doesNotMatch(editorial, /\.asset-quick-view \{[^}]*opacity:\s*0/);
  assert.doesNotMatch(editorial, /\.asset-quick-view \{[^}]*position:\s*absolute/);

  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /SJ-TEST0001/);
  assert.match(html, /1 foto/);
  assert.match(html, /Bangunan/);
  assert.match(html, /Rumah/);
  assert.match(html, /Rumah tinggal dekat pusat kota/);
  assert.match(html, /Bandung/);
  assert.match(html, /Jawa Barat/);
  assert.match(html, /Diterbitkan oleh/);
  assert.match(html, /BPRS Amanah Nasional/);
  assert.match(html, /Tersedia/);
  assert.match(html, /Diperbarui/);
  assert.match(html, /22 Agustus 2026/);
  assert.match(html, /Lihat ringkas/);
  assert.match(html, /href="\/aset\/sj-test0001"/);
  assert.match(html, /href="\/bprs\/bprs-amanah-nasional"/);
});

test("modal aset mengunci dossier ringkas, layout premium, dan sheet mobile", async () => {
  const [assetDossier, editorial] = await Promise.all([
    readFile(new URL("../app/components/AssetDossier.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/editorial.css", import.meta.url), "utf8"),
  ]);

  assert.match(assetDossier, /detail\?\.specs\.slice\(0, 5\)/);
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
  assert.match(editorial, /\.dossier-whatsapp \{[^}]*background: var\(--iris\)/);
  assert.match(editorial, /\.dossier-mobile-action \{ display: none; \}/);
  assert.match(editorial, /@media \(max-width: 920px\)[\s\S]*\.dossier \{[^}]*width: 100vw;[^}]*height: 100dvh/);
  assert.match(editorial, /@media \(max-width: 920px\)[\s\S]*\.dossier-information \{[^}]*grid-template-rows: auto minmax\(0,1fr\) auto/);
  assert.match(editorial, /@media \(max-width: 920px\)[\s\S]*\.dossier-mobile-action \{ display: block/);
  assert.match(editorial, /\.dossier-whatsapp-desktop \{ display: none; \}/);
});

test("detail aset mengunci urutan informasi, PhotoSwipe lazy-load, dan CTA mobile tetap", async () => {
  const [page, gallery, routes, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/aset/[slug]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/AssetDetailGallery.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/routes.css", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  const orderedSections = [
    "asset-detail-back-row",
    "<AssetDetailGallery",
    "asset-detail-heading",
    "asset-detail-lead",
    "asset-contact-panel",
    "asset-detail-specs",
    "asset-publisher",
    "asset-publication-note",
    "related-assets",
  ].map((needle) => page.indexOf(needle));
  assert.ok(orderedSections.every((position) => position >= 0));
  assert.ok(orderedSections.every((position, index) => index === 0 || position > orderedSections[index - 1]));
  assert.match(page, /className="asset-mobile-whatsapp"/);
  assert.match(page, /Tanyakan aset ini/);
  assert.match(page, /Harga, ketersediaan, dokumen, dan proses berikutnya/);
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
  assert.match(gallery, /gallery\.querySelector<HTMLElement>\("\.asset-gallery-slide\.is-active"\)\?\.focus\(\)/);
  assert.match(gallery, /images\.length > 1 &&/);
  assert.match(gallery, /aria-pressed=\{index === activeIndex\}/);
  assert.doesNotMatch(gallery, /MediaLightbox/);

  assert.match(routes, /\.asset-gallery-thumbnails \{[^}]*overflow-x: auto;[^}]*scrollbar-color: var\(--iris\)/);
  assert.match(routes, /\.asset-gallery-arrows button \{[^}]*background: transparent/);
  assert.match(routes, /\.asset-detail-editorial \.asset-detail-information \{[^}]*animation: none/);
  assert.match(routes, /\.asset-mobile-whatsapp \{ display: none; \}/);
  assert.match(routes, /@media \(max-width: 620px\)[\s\S]*\.asset-mobile-whatsapp \{[^}]*position: fixed;[^}]*bottom: max\(10px,env\(safe-area-inset-bottom\)\);[^}]*background: var\(--iris\)/);
  assert.match(routes, /\.sj-photoswipe \{ --pswp-bg: #09111d; \}/);
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

test("direktori BPRS mengunci hierarki ringkas, adaptasi jumlah, dan field publik", async () => {
  const [directoryPage, directory, profilePage, assetCard, routes, publicService] = await Promise.all([
    readFile(new URL("../app/bprs/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/BprsDirectory.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/bprs/[slug]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/AssetCard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/routes.css", import.meta.url), "utf8"),
    readFile(new URL("../apps/api/src/public-service.ts", import.meta.url), "utf8"),
  ]);

  assert.match(directoryPage, /Direktori BPRS penerbit/);
  assert.match(directoryPage, /Hanya BPRS dengan profil dan aset aktif yang ditampilkan/);
  assert.doesNotMatch(directoryPage, /BPRS penerbit,\s*terlihat jelas/);
  assert.match(directory, /const SEARCH_THRESHOLD = 8/);
  assert.match(directory, /profiles\.length === 1 && !hasFilters && !nextCursor/);
  assert.match(directory, /profiles\.length >= SEARCH_THRESHOLD/);
  assert.match(directory, /className="bprs-publisher-feature"/);
  assert.match(directory, /className="bprs-index-list"/);
  assert.match(directory, /Cari BPRS atau wilayah/);
  assert.match(directory, /nextCursor/);
  assert.match(directory, /useReducedMotion/);

  assert.match(profilePage, /className="site-frame bprs-profile-masthead"/);
  assert.match(profilePage, /className="bprs-profile-identity"/);
  assert.match(profilePage, /className="bprs-profile-mark-label"/);
  assert.match(profilePage, /<AssetCard[\s\S]*showPublisher=\{false\}/);
  assert.match(profilePage, /className="bprs-profile-empty"/);
  assert.match(profilePage, /Informasi publik ini dikelola oleh BPRS penerbit melalui ruwang/);
  assert.doesNotMatch(profilePage, /PublicMedia|bprs-asset-index|bprs-profile-overview/);
  assert.match(assetCard, /showPublisher = true/);
  assert.match(assetCard, /\{showPublisher && \(/);

  assert.match(routes, /\.bprs-directory-masthead \{[^}]*grid-template-columns/);
  assert.match(routes, /\.bprs-publisher-feature > a \{[^}]*grid-template-columns/);
  assert.match(routes, /\.bprs-profile-assets-grid--count-1/);
  assert.match(routes, /\.bprs-profile-mark-label \{ display: none; \}/);
  assert.doesNotMatch(routes, /\.bprs-profile-mark-wrap > span \{ display: none; \}/);
  assert.match(routes, /@media \(max-width: 620px\)[\s\S]*\.bprs-profile-assets-grid, \.bprs-profile-assets-grid--count-2 \{ grid-template-columns: 1fr/);
  assert.match(routes, /prefers-reduced-motion[\s\S]*\.bprs-profile-identity > \*, \.bprs-profile-source \{ animation: none; \}/);
  assert.doesNotMatch(routes, /\.bprs-page-intro|\.bprs-directory-tools|\.bprs-profile-overview|\.bprs-asset-index/);

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
    assert.match(html, /Satu penerbit terhubung/);
    assert.match(html, /bprs-publisher-feature/);
    assert.doesNotMatch(html, /role="search"/);

    fixtureInstitutionCount = 5;
    response = await render("/bprs");
    assert.equal(response.status, 200);
    html = await response.text();
    assert.match(html, /bprs-index-list/);
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
    assert.match(html, /Belum ada BPRS penerbit aktif/);
    assert.doesNotMatch(html, /role="search"/);

    fixtureAssetCount = 0;
    fixtureInstitutionCount = 1;
    response = await render("/bprs/bprs-amanah-nasional");
    assert.equal(response.status, 200);
    html = await response.text();
    assert.match(html, /Belum ada aset aktif dari BPRS ini/);
    assert.match(html, /aria-label="0 aset aktif"/);
    assert.doesNotMatch(html, /class="asset-card/);

    fixtureAssetCount = 1;
    response = await render("/bprs/bprs-amanah-nasional");
    assert.equal(response.status, 200);
    html = await response.text();
    assert.match(html, /bprs-profile-assets-grid--count-1/);
    assert.match(html, /Rumah tinggal dekat pusat kota/);
    assert.doesNotMatch(html, /Diterbitkan oleh/);
    assert.doesNotMatch(html, /alamat lengkap|nomor telepon|email/i);
  } finally {
    fixtureAssetCount = originalAssetCount;
    fixtureInstitutionCount = originalInstitutionCount;
  }
});

test("halaman Cara Minat mengunci alur, privasi kontak, dan bahasa visual publik", async () => {
  const [page, journey, routes, designSystem, publicService] = await Promise.all([
    readFile(new URL("../app/cara-minat/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/InterestJourney.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/routes.css", import.meta.url), "utf8"),
    readFile(new URL("../app/design-system.css", import.meta.url), "utf8"),
    readFile(new URL("../apps/api/src/public-service.ts", import.meta.url), "utf8"),
  ]);

  const message = "Siang Pak/Bu, saya ingin mengetahui informasi lebih lanjut terkait aset {reference_code} — {asset_title}.";

  assert.match(page, /className="site-frame interest-masthead"/);
  assert.match(page, /Tertarik pada aset\? Mulai dari sini\./);
  assert.match(page, /<InterestJourney \/>/);
  assert.doesNotMatch(page, /Lihat dengan tenang|interest-hero|interest-sequence|interest-notes/);

  assert.match(journey, /label: "Temukan aset"/);
  assert.match(journey, /label: "Periksa informasi publik"/);
  assert.match(journey, /label: "Hubungi BPRS"/);
  assert.match(journey, /Nomor tujuan tidak ditampilkan di sini\./);
  assert.match(journey, /kontak marketing yang sudah dipilih dan diverifikasi BPRS/);
  assert.match(journey, /Seputar Jaminan tidak menentukan harga, legalitas, kondisi akhir, atau keputusan transaksi/);
  assert.match(journey, /useReducedMotion/);
  assert.match(journey, /motion\.li/);
  assert.match(journey, /Siang Pak\/Bu, saya ingin mengetahui informasi lebih lanjut terkait aset \[kode aset\] — \[judul aset\]\./);

  assert.match(routes, /\.interest-masthead h1 \{[^}]*font-size: clamp\(52px,5\.4vw,76px\)/);
  assert.match(routes, /\.interest-message-preview \{[^}]*background: var\(--night\);[^}]*box-shadow: 18px 18px 0 var\(--iris-soft\)/);
  assert.match(routes, /\.interest-guidance-grid \{[^}]*grid-template-columns: repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(routes, /@media \(max-width: 620px\)[\s\S]*\.interest-masthead h1 \{ font-size: 48px; \}/);
  assert.match(routes, /prefers-reduced-motion[\s\S]*\.interest-flow-step/);
  assert.doesNotMatch(routes, /\.interest-hero|\.interest-sequence|\.interest-step(?:\W)|\.interest-notes/);
  assert.doesNotMatch(designSystem, /\.interest-hero|\.interest-sequence|\.interest-step(?:\W)|\.interest-notes/);
  assert.match(designSystem, /\.interest-masthead h1/);
  assert.match(designSystem, /\.interest-flow-marker/);

  assert.ok(publicService.includes(message));
});

test("halaman Cara Minat merender panduan tanpa nomor WhatsApp mentah", async () => {
  const response = await render("/cara-minat");
  assert.equal(response.status, 200);
  const html = await response.text();

  assert.match(html, /Tertarik pada aset\? Mulai dari sini\./);
  assert.match(html, /Temukan aset/);
  assert.match(html, /Periksa informasi publik/);
  assert.match(html, /Hubungi BPRS/);
  assert.match(html, /Siang Pak\/Bu, saya ingin mengetahui informasi lebih lanjut terkait aset \[kode aset\] — \[judul aset\]\./);
  assert.match(html, /Yang sebaiknya ditanyakan/);
  assert.match(html, /Yang harus dikonfirmasi ulang/);
  assert.match(html, /Seputar Jaminan tidak menentukan harga, legalitas, kondisi akhir, atau keputusan transaksi/);
  assert.match(html, /href="\/katalog"/);
  assert.match(html, /href="\/bprs"/);
  assert.doesNotMatch(html, /(?:\+?62|0)8\d{7,}|wa\.me|Lihat dengan tenang/);
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
  assert.match(globalError, /<html lang="id">/);
  assert.match(globalError, /<body>/);
  assert.match(globalError, /Gangguan halaman/);
  assert.match(globalError, /\{ reset \}/);
  assert.match(globalError, /retry=\{reset\}/);

  assert.match(publicApi, /PUBLIC_API_TIMEOUT/);
  assert.match(publicApi, /publicDataStateKind/);
  assert.match(catalogClient, /Belum ada aset yang diterbitkan/);
  assert.match(catalogClient, /Tidak ada hasil pencarian/);
  assert.match(catalogClient, /hasSearchCriteria/);

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
    assert.match(html, /Katalog belum tersedia/);
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
    assert.match(html, /seputarjaminan/);
    assert.doesNotMatch(html, /This page could not be found|Something went wrong|404: This page/i);
  }
});

test("system state menampilkan timeout ringan tanpa aset contoh", async () => {
  const response = await render("/katalog?q=__timeout__");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Waktu tunggu habis/);
  assert.match(html, /Katalog memerlukan waktu lebih lama/);
  assert.match(html, /melewati batas waktu aman/);
  assert.doesNotMatch(html, /Rumah tinggal dekat pusat kota|BPRS Amanah Nasional/);
});

for (const [pathname, pattern] of [
  ["/katalog", /Cari aset yang sesuai kebutuhan/],
  ["/bprs", /Direktori BPRS penerbit/],
  ["/bprs/bprs-amanah-nasional", /BPRS Amanah Nasional/],
  ["/aset/sj-test0001", /Rumah tinggal dekat pusat kota/],
  ["/cara-minat", /Tertarik pada aset/],
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
  assert.match(html, /seputarjaminan/);
});

test("kegagalan API menampilkan error nyata tanpa data fixture sebagai fallback", async () => {
  fixtureFailureMode = true;
  try {
    const response = await render("/");
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /Katalog belum dapat dimuat/);
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
  assert.match(assetCard, /returnFocusRef={quickViewTriggerRef}/);
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
  assert.match(packageJson, /"next": "16\.3\.4"/);
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
  assert.match(motionContract, /standard:\s*0\.28/);
  assert.match(motionContract, /slow:\s*0\.4/);
  assert.match(motionContract, /whileTap:\s*reducedMotion \? undefined : \{ scale: 0\.985 \}/);
  assert.match(motionContract, /viewport:\s*\{ once: true, amount: 0\.18 \}/);
  assert.doesNotMatch(motionContract, /spring|bounce|repeat:\s*Infinity/i);

  assert.match(revealSection, /<motion\.section/);
  assert.match(revealSection, /revealOnce\(reducedMotion, delay\)/);
  assert.match(homepage, /<EditorialRevealSection className="category-index site-frame"/);
  assert.match(homepage, /<EditorialRevealSection className="home-curation site-frame"/);
  assert.match(homepage, /<EditorialRevealSection className="home-process"/);
  assert.match(hero, /<AnimatePresence mode="wait" initial=\{false\}>/);
  assert.match(hero, /pressFeedback\(reducedMotion\)/);
  assert.doesNotMatch(hero, /setInterval|setTimeout|\b(?:autoplay|pause|play)\b/i);

  assert.doesNotMatch(catalogPage, /<CatalogClient[\s\S]*key=/);
  assert.match(catalogClient, /<AnimatePresence>/);
  assert.match(catalogClient, /className="filter-selection-mark"/);
  assert.match(catalogClient, /<CatalogSearch key=\{q\}/);
  assert.match(catalogClient, /<DesktopFilterPanel[\s\S]*key=\{`\$\{bprs\}[\s\S]*\$\{province\}`\}/);
  assert.match(catalogClient, /<LayoutGroup id="catalog-results">/);
  assert.match(catalogClient, /layout=\{reducedMotion \? false : true\}/);
  assert.match(assetCard, /layout=\{reducedMotion \? false : "position"\}/);
  assert.match(assetCard, /pressFeedback\(reducedMotion\)/);

  assert.match(dossier, /duration: PUBLIC_MOTION_DURATION\.slow/);
  assert.match(dossier, /initial=\{reducedMotion \? \{ opacity: 0 \}/);
  assert.match(lightbox, /duration: PUBLIC_MOTION_DURATION\.slow/);
  assert.match(lightbox, /initial=\{reducedMotion \? \{ opacity: 0 \}/);
  assert.match(gallery, /duration: PUBLIC_MOTION_DURATION\.standard/);

  assert.match(designSystem, /--motion-fast:\s*180ms/);
  assert.match(designSystem, /--motion-standard:\s*280ms/);
  assert.match(designSystem, /--motion-slow:\s*400ms/);
  assert.doesNotMatch(`${designSystem}\n${editorial}\n${globals}\n${routes}`, /(?:440|520|560|580|600|680|700)ms/);
  assert.match(`${designSystem}\n${globals}\n${routes}`, /prefers-reduced-motion:\s*reduce/);
  assert.match(designSystem, /\.mobile-navigation nav a \{\s*opacity: 1;\s*transform: none;/);
  assert.match(routes, /\.bprs-marquee-viewport\.is-rail \.bprs-marquee-track \{ width: 100%; animation: none; transform: none !important; \}/);
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
