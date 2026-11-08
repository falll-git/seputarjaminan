import type {
  PublicAssetCard,
  PublicAssetDetail,
  PublicInstitution,
  PublicTaxonomy,
} from "@seputarjaminan/contracts";
import { loadWebsiteConfig } from "@seputarjaminan/config/public";
import "server-only";
import { isPublicMediaId, publicMediaIdFromUrl, toSameOriginPublicMediaUrl } from "./public-media";
import { PublicQueryError } from "./public-page-query";
import { PUBLICATION_CATEGORIES, PUBLIC_ATTRIBUTE_VOCABULARIES } from "@seputarjaminan/contracts/public-constants";

type QueryValue = string | number | undefined;

export type PublicAssetList = {
  items: PublicAssetCard[];
  next_cursor: string | null;
};

export type PublicInstitutionList = {
  items: PublicInstitution[];
  next_cursor: string | null;
};

export type AssetListQuery = {
  q?: string;
  category?: string;
  subcategory?: string;
  province?: string;
  city_regency?: string;
  institution?: string;
  sort?: "NEWEST" | "OLDEST";
  cursor?: string;
  limit?: number;
};

export type InstitutionListQuery = {
  q?: string;
  province?: string;
  cursor?: string;
  limit?: number;
};

export class PublicApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "PublicApiError";
  }
}

function isRequestTimeout(error: unknown) {
  return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function allowKeys(value: Record<string, unknown>, keys: string[]) {
  if (Object.keys(value).some(key => !keys.includes(key))) {
    throw new PublicApiError(502, "PUBLIC_RESPONSE_INVALID", "Respons memuat field di luar kontrak publik.");
  }
}

const attributeKeys: Record<string, string[]> = {
  TANAH: ["land_area_m2", "contour", "road_access"],
  BANGUNAN: ["land_area_m2", "building_area_m2", "floor_count", "public_usage"],
  MESIN_PERALATAN: ["brand_or_manufacturer", "model_or_type", "manufacture_year", "public_capacity", "public_condition"],
  KENDARAAN: ["brand", "model_or_type", "manufacture_year", "transmission", "fuel_type", "mileage_km", "public_condition"],
};
const summaryKeys: Record<string, string[]> = {
  TANAH: ["land_area_m2"], BANGUNAN: ["land_area_m2", "building_area_m2"],
  MESIN_PERALATAN: ["brand_or_manufacturer", "model_or_type"], KENDARAAN: ["model_or_type", "mileage_km"],
};
function assertAttributes(value: unknown, keys: string[]) {
  if (!isObject(value)) throw new PublicApiError(502, "PUBLIC_RESPONSE_INVALID", "Atribut publik tidak valid.");
  allowKeys(value, keys);
  for (const [key, item] of Object.entries(value)) {
    if (["land_area_m2", "building_area_m2", "floor_count", "manufacture_year", "mileage_km"].includes(key)) requireNumber(item, key);
    else {
      requireString(item, key);
      const vocabulary = (PUBLIC_ATTRIBUTE_VOCABULARIES as Readonly<Record<string, readonly string[]>>)[key];
      if (vocabulary && !vocabulary.includes(String(item))) throw new PublicApiError(502, "PUBLIC_RESPONSE_INVALID", "Nilai atribut di luar kontrak publik.");
    }
  }
}

function requireString(value: unknown, field: string) {
  if (typeof value !== "string" || value.trim().length < 1) {
    throw new PublicApiError(502, "PUBLIC_RESPONSE_INVALID", `Respons katalog tidak memuat ${field} yang valid.`);
  }
}

function requireNumber(value: unknown, field: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new PublicApiError(502, "PUBLIC_RESPONSE_INVALID", `Respons katalog tidak memuat ${field} yang valid.`);
  }
}

function requirePositiveInteger(value: unknown, field: string) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw new PublicApiError(502, "PUBLIC_RESPONSE_INVALID", `Respons katalog tidak memuat ${field} yang valid.`);
  }
}

function assertPublicProof(value: Record<string, unknown>, versionField: string, pathname: string) {
  // Optional V1 fields describe an applied SJ event, not a bank draft or an
  // approval. Older responses may omit them; never infer a missing version/URL.
  if (value[versionField] !== undefined) requirePositiveInteger(value[versionField], versionField);
  if (value.public_page_url === undefined || value.public_page_url === null) return;
  requireString(value.public_page_url, "alamat halaman publik");
  let url: URL;
  try { url = new URL(String(value.public_page_url)); }
  catch { throw new PublicApiError(502, "PUBLIC_RESPONSE_INVALID", "Alamat halaman publik tidak valid."); }
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== pathname) {
    throw new PublicApiError(502, "PUBLIC_RESPONSE_INVALID", "Alamat halaman publik tidak sesuai identitas data.");
  }
}

function assertMedia(value: unknown) {
  if (!isObject(value)) throw new PublicApiError(502, "PUBLIC_RESPONSE_INVALID", "Data gambar katalog tidak valid.");
  allowKeys(value, ["url", "width", "height", "alt_text"]);
  requireString(value.url, "alamat gambar");
  requirePositiveInteger(value.width, "lebar gambar");
  requirePositiveInteger(value.height, "tinggi gambar");
  if (typeof value.alt_text !== "string") {
    throw new PublicApiError(502, "PUBLIC_RESPONSE_INVALID", "Respons katalog tidak memuat keterangan gambar yang valid.");
  }
  if (!publicMediaIdFromUrl(String(value.url))) {
    throw new PublicApiError(502, "PUBLIC_RESPONSE_INVALID", "Alamat gambar katalog tidak sesuai kontrak media publik.");
  }
}

function assertInstitutionSummary(value: unknown, full = false) {
  if (!isObject(value)) throw new PublicApiError(502, "PUBLIC_RESPONSE_INVALID", "Data BPRS penerbit tidak valid.");
  allowKeys(value, ["public_slug", "public_name", "public_mark_url", ...(full ? ["short_description", "office_city_regency", "office_province", "published_asset_count", "public_profile_version", "public_page_url"] : [])]);
  requireString(value.public_slug, "identitas BPRS");
  requireString(value.public_name, "nama BPRS");
  requireString(value.public_mark_url, "logo BPRS");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(String(value.public_slug))) throw new PublicApiError(502, "PUBLIC_RESPONSE_INVALID", "Identitas BPRS tidak valid.");
  if (!publicMediaIdFromUrl(String(value.public_mark_url))) {
    throw new PublicApiError(502, "PUBLIC_RESPONSE_INVALID", "Alamat logo BPRS tidak sesuai kontrak media publik.");
  }
}

function assertAssetCard(value: unknown, full = false): asserts value is PublicAssetCard {
  if (!isObject(value)) throw new PublicApiError(502, "PUBLIC_RESPONSE_INVALID", "Data aset katalog tidak valid.");
  allowKeys(value, ["reference_code", "title", "category", "subcategory", "location", "cover", "institution", "availability", "photo_count", "public_updated_at", "summary_attributes", ...(full ? ["description", "attributes", "media", "whatsapp_url", "public_asset_version", "public_page_url"] : [])]);
  requireString(value.reference_code, "kode referensi");
  requireString(value.title, "judul aset");
  requireString(value.category, "kategori aset");
  requireString(value.subcategory, "subkategori aset");
  if (!/^SJ-[A-Z0-9]{8}$/u.test(String(value.reference_code)) || !PUBLICATION_CATEGORIES[String(value.category)]?.includes(String(value.subcategory))) {
    throw new PublicApiError(502, "PUBLIC_RESPONSE_INVALID", "Identitas atau kategori aset tidak valid.");
  }
  if (value.summary_attributes !== undefined) assertAttributes(value.summary_attributes, summaryKeys[String(value.category)]);
  if (value.availability !== "AVAILABLE") {
    throw new PublicApiError(502, "PUBLIC_RESPONSE_INVALID", "Status ketersediaan aset tidak valid.");
  }
  const photoCount = value.photo_count;
  requireNumber(photoCount, "jumlah foto aset");
  if (typeof photoCount !== "number" || !Number.isInteger(photoCount) || photoCount < 1 || photoCount > 10) {
    throw new PublicApiError(502, "PUBLIC_RESPONSE_INVALID", "Jumlah foto aset tidak sesuai kontrak publik.");
  }
  requireString(value.public_updated_at, "tanggal pembaruan");
  if (Number.isNaN(Date.parse(String(value.public_updated_at)))) throw new PublicApiError(502, "PUBLIC_RESPONSE_INVALID", "Tanggal publik tidak valid.");
  if (!isObject(value.location)) throw new PublicApiError(502, "PUBLIC_RESPONSE_INVALID", "Lokasi aset tidak valid.");
  allowKeys(value.location, ["city_regency", "province"]);
  requireString(value.location.city_regency, "kota atau kabupaten");
  requireString(value.location.province, "provinsi");
  assertMedia(value.cover);
  assertInstitutionSummary(value.institution);
}

function assertAssetDetail(value: unknown): asserts value is PublicAssetDetail {
  assertAssetCard(value, true);
  const detail = value as unknown as Record<string, unknown>;
  requireString(detail.description, "deskripsi aset");
  requireString(detail.whatsapp_url, "tautan WhatsApp");
  assertAttributes(detail.attributes, attributeKeys[value.category]);
  if (!Array.isArray(detail.media) || detail.media.length < 1 || detail.media.length > 10 || detail.media.length !== value.photo_count) {
    throw new PublicApiError(502, "PUBLIC_RESPONSE_INVALID", "Galeri aset tidak tersedia.");
  }
  detail.media.forEach(assertMedia);
  assertPublicProof(detail, "public_asset_version", `/aset/${encodeURIComponent(value.reference_code)}`);
}

function assertInstitution(value: unknown): asserts value is PublicInstitution {
  assertInstitutionSummary(value, true);
  if (!isObject(value)) return;
  requireString(value.short_description, "deskripsi BPRS");
  requireString(value.office_city_regency, "kota kantor BPRS");
  requireString(value.office_province, "provinsi kantor BPRS");
  requireNumber(value.published_asset_count, "jumlah aset BPRS");
  if (!Number.isSafeInteger(value.published_asset_count) || Number(value.published_asset_count) < 0) throw new PublicApiError(502, "PUBLIC_RESPONSE_INVALID", "Jumlah aset BPRS tidak valid.");
  assertPublicProof(value, "public_profile_version", `/bprs/${encodeURIComponent(String(value.public_slug))}`);
}

function apiBaseUrl() {
  try {
    return loadWebsiteConfig(process.env).publicApiBaseUrl;
  } catch {
    throw new PublicApiError(503, "PUBLIC_API_CONFIG_INVALID", "Layanan katalog belum dikonfigurasi dengan benar.");
  }
}

export async function requestPublicMedia(mediaId: string, variant: "main" | "card" | "thumb" = "main") {
  if (!isPublicMediaId(mediaId)) {
    throw new PublicApiError(404, "MEDIA_NOT_FOUND", "Gambar tidak tersedia.");
  }
  try {
    return await fetch(endpoint(`/v1/public/media/${encodeURIComponent(mediaId)}${variant === "main" ? "" : `?variant=${variant}`}`), {
      cache: "no-store",
      headers: { Accept: "image/webp" },
      redirect: "error",
      signal: AbortSignal.timeout(5_000),
    });
  } catch (error) {
    if (isRequestTimeout(error)) {
      throw new PublicApiError(504, "PUBLIC_MEDIA_TIMEOUT", "Layanan gambar melewati batas waktu aman.");
    }
    throw new PublicApiError(503, "PUBLIC_API_UNAVAILABLE", "Layanan gambar sedang tidak dapat dihubungi.");
  }
}

function rewriteMediaForBrowser<T extends { url: string }>(media: T): T {
  return { ...media, url: toSameOriginPublicMediaUrl(media.url) };
}

export function publicAssetForBrowser(detail: PublicAssetDetail): PublicAssetDetail {
  return {
    ...detail,
    cover: rewriteMediaForBrowser(detail.cover),
    media: detail.media.map(rewriteMediaForBrowser),
    institution: {
      ...detail.institution,
      public_mark_url: toSameOriginPublicMediaUrl(detail.institution.public_mark_url),
    },
  };
}

function endpoint(pathname: string, query?: Record<string, QueryValue>) {
  const url = new URL(`${apiBaseUrl()}${pathname}`);
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && String(value).trim()) url.searchParams.set(key, String(value));
  });
  return url;
}

async function requestJson(pathname: string, query?: Record<string, QueryValue>) {
  let response: Response;
  try {
    response = await fetch(endpoint(pathname, query), {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5_000),
    });
  } catch (error) {
    if (isRequestTimeout(error)) {
      throw new PublicApiError(504, "PUBLIC_API_TIMEOUT", "Katalog melewati batas waktu aman. Silakan coba kembali.");
    }
    throw new PublicApiError(503, "PUBLIC_API_UNAVAILABLE", "Katalog sedang tidak dapat dihubungi. Silakan coba kembali.");
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new PublicApiError(502, "PUBLIC_RESPONSE_INVALID", "Layanan katalog mengirim respons yang tidak dapat dibaca.");
  }

  if (!response.ok) {
    const code = isObject(payload) && typeof payload.code === "string" ? payload.code : "PUBLIC_API_ERROR";
    const message = isObject(payload) && typeof payload.message === "string"
      ? payload.message
      : "Layanan katalog belum dapat memenuhi permintaan.";
    throw new PublicApiError(response.status, code, message);
  }
  return payload;
}

function assertCursorList(value: unknown, itemCheck: (item: unknown) => void) {
  if (!isObject(value) || !Array.isArray(value.items) || (value.next_cursor !== null && typeof value.next_cursor !== "string")) {
    throw new PublicApiError(502, "PUBLIC_RESPONSE_INVALID", "Daftar katalog tidak valid.");
  }
  allowKeys(value, ["items", "next_cursor"]);
  if (value.items.length > 100) throw new PublicApiError(502, "PUBLIC_RESPONSE_INVALID", "Ukuran halaman publik tidak valid.");
  value.items.forEach(item => itemCheck(item));
}

export async function listPublicAssets(query: AssetListQuery = {}): Promise<PublicAssetList> {
  const payload = await requestJson("/v1/public/assets", query);
  assertCursorList(payload, assertAssetCard);
  return payload as PublicAssetList;
}

export async function getPublicShowcase(): Promise<PublicAssetList> {
  const payload = await requestJson("/v1/public/showcase");
  assertCursorList(payload, assertAssetCard);
  const list = payload as PublicAssetList;
  if (list.items.length > 8 || list.next_cursor !== null || new Set(list.items.map(item => item.reference_code)).size !== list.items.length) {
    throw new PublicApiError(502, "PUBLIC_RESPONSE_INVALID", "Etalase aset tidak valid.");
  }
  return list;
}

export async function getPublicAsset(referenceCode: string): Promise<PublicAssetDetail> {
  if (!/^SJ-[A-Z0-9]{8}$/u.test(referenceCode)) {
    throw new PublicApiError(404, "ASSET_NOT_FOUND", "Aset tidak tersedia.");
  }
  const payload = await requestJson(`/v1/public/assets/${encodeURIComponent(referenceCode)}`);
  assertAssetDetail(payload);
  if (payload.reference_code !== referenceCode) throw new PublicApiError(502, "PUBLIC_RESPONSE_INVALID", "Identitas aset berbeda dari permintaan.");
  return payload;
}

export async function listPublicInstitutions(query: InstitutionListQuery = {}): Promise<PublicInstitutionList> {
  const payload = await requestJson("/v1/public/institutions", query);
  assertCursorList(payload, assertInstitution);
  return payload as PublicInstitutionList;
}

export async function getPublicInstitution(publicSlug: string): Promise<PublicInstitution> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(publicSlug)) {
    throw new PublicApiError(404, "INSTITUTION_NOT_FOUND", "BPRS penerbit tidak tersedia.");
  }
  const payload = await requestJson(`/v1/public/institutions/${encodeURIComponent(publicSlug)}`);
  assertInstitution(payload);
  if (payload.public_slug !== publicSlug) throw new PublicApiError(502, "PUBLIC_RESPONSE_INVALID", "Identitas BPRS berbeda dari permintaan.");
  return payload;
}

export async function getPublicTaxonomy(): Promise<PublicTaxonomy> {
  const payload = await requestJson("/v1/public/taxonomy");
  if (!isObject(payload) || payload.version !== 1 || !isObject(payload.categories) || !isObject(payload.vocabularies)) {
    throw new PublicApiError(502, "PUBLIC_RESPONSE_INVALID", "Taksonomi katalog tidak valid.");
  }
  allowKeys(payload, ["version", "categories", "vocabularies"]);
  for (const [actual, expected] of [[payload.categories, PUBLICATION_CATEGORIES], [payload.vocabularies, PUBLIC_ATTRIBUTE_VOCABULARIES]] as const) {
    allowKeys(actual, Object.keys(expected));
    for (const [key, values] of Object.entries(expected)) {
      const entries = actual[key];
      if (!Array.isArray(entries) || entries.length !== values.length ||
        new Set(entries).size !== entries.length || entries.some(item => typeof item !== "string" || !(values as readonly string[]).includes(item))) {
        throw new PublicApiError(502, "PUBLIC_RESPONSE_INVALID", "Taksonomi tidak sesuai kontrak V1.");
      }
    }
  }
  return payload as PublicTaxonomy;
}

export function referenceCodeFromSlug(slug: string) {
  try {
    const referenceCode = decodeURIComponent(slug).toLocaleUpperCase("en-US");
    return /^SJ-[A-Z0-9]{8}$/u.test(referenceCode) ? referenceCode : null;
  } catch { return null; }
}

export function isPublicNotFound(error: unknown) {
  return error instanceof PublicApiError && error.status === 404;
}

export function publicDataStateKind(error: unknown): "error" | "timeout" | "invalid-query" {
  if (error instanceof PublicQueryError || (error instanceof PublicApiError && error.status === 400)) return "invalid-query";
  return error instanceof PublicApiError && error.code === "PUBLIC_API_TIMEOUT" ? "timeout" : "error";
}
