import type {
  PublicAssetCard,
  PublicAssetDetail,
  PublicInstitution,
  PublicTaxonomy,
} from "@seputarjaminan/contracts";
import "server-only";
import { isPublicMediaId, publicMediaIdFromUrl, toSameOriginPublicMediaUrl } from "./public-media";

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

function assertMedia(value: unknown) {
  if (!isObject(value)) throw new PublicApiError(502, "PUBLIC_RESPONSE_INVALID", "Data gambar katalog tidak valid.");
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

function assertInstitutionSummary(value: unknown) {
  if (!isObject(value)) throw new PublicApiError(502, "PUBLIC_RESPONSE_INVALID", "Data BPRS penerbit tidak valid.");
  requireString(value.public_slug, "identitas BPRS");
  requireString(value.public_name, "nama BPRS");
  requireString(value.public_mark_url, "logo BPRS");
  if (!publicMediaIdFromUrl(String(value.public_mark_url))) {
    throw new PublicApiError(502, "PUBLIC_RESPONSE_INVALID", "Alamat logo BPRS tidak sesuai kontrak media publik.");
  }
}

function assertAssetCard(value: unknown): asserts value is PublicAssetCard {
  if (!isObject(value)) throw new PublicApiError(502, "PUBLIC_RESPONSE_INVALID", "Data aset katalog tidak valid.");
  requireString(value.reference_code, "kode referensi");
  requireString(value.title, "judul aset");
  requireString(value.category, "kategori aset");
  requireString(value.subcategory, "subkategori aset");
  if (value.availability !== "AVAILABLE") {
    throw new PublicApiError(502, "PUBLIC_RESPONSE_INVALID", "Status ketersediaan aset tidak valid.");
  }
  const photoCount = value.photo_count;
  requireNumber(photoCount, "jumlah foto aset");
  if (typeof photoCount !== "number" || !Number.isInteger(photoCount) || photoCount < 1 || photoCount > 10) {
    throw new PublicApiError(502, "PUBLIC_RESPONSE_INVALID", "Jumlah foto aset tidak sesuai kontrak publik.");
  }
  requireString(value.public_updated_at, "tanggal pembaruan");
  if (!isObject(value.location)) throw new PublicApiError(502, "PUBLIC_RESPONSE_INVALID", "Lokasi aset tidak valid.");
  requireString(value.location.city_regency, "kota atau kabupaten");
  requireString(value.location.province, "provinsi");
  assertMedia(value.cover);
  assertInstitutionSummary(value.institution);
}

function assertAssetDetail(value: unknown): asserts value is PublicAssetDetail {
  assertAssetCard(value);
  const detail = value as unknown as Record<string, unknown>;
  requireString(detail.description, "deskripsi aset");
  requireString(detail.whatsapp_url, "tautan WhatsApp");
  if (!isObject(detail.attributes)) throw new PublicApiError(502, "PUBLIC_RESPONSE_INVALID", "Atribut aset tidak valid.");
  if (!Array.isArray(detail.media) || detail.media.length < 1) {
    throw new PublicApiError(502, "PUBLIC_RESPONSE_INVALID", "Galeri aset tidak tersedia.");
  }
  detail.media.forEach(assertMedia);
}

function assertInstitution(value: unknown): asserts value is PublicInstitution {
  assertInstitutionSummary(value);
  if (!isObject(value)) return;
  requireString(value.short_description, "deskripsi BPRS");
  requireString(value.office_city_regency, "kota kantor BPRS");
  requireString(value.office_province, "provinsi kantor BPRS");
  requireNumber(value.published_asset_count, "jumlah aset BPRS");
}

function apiBaseUrl() {
  const configured = process.env.SJ_PUBLIC_API_BASE_URL?.trim() || "http://127.0.0.1:4100";
  let parsed: URL;
  try {
    parsed = new URL(configured);
  } catch {
    throw new PublicApiError(503, "PUBLIC_API_CONFIG_INVALID", "Layanan katalog belum dikonfigurasi dengan benar.");
  }
  if (!/^https?:$/u.test(parsed.protocol)) {
    throw new PublicApiError(503, "PUBLIC_API_CONFIG_INVALID", "Layanan katalog belum dikonfigurasi dengan benar.");
  }
  return parsed.toString().replace(/\/$/u, "");
}

export async function requestPublicMedia(mediaId: string) {
  if (!isPublicMediaId(mediaId)) {
    throw new PublicApiError(404, "MEDIA_NOT_FOUND", "Gambar tidak tersedia.");
  }
  try {
    return await fetch(endpoint(`/v1/public/media/${encodeURIComponent(mediaId)}`), {
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
  value.items.forEach(itemCheck);
}

export async function listPublicAssets(query: AssetListQuery = {}): Promise<PublicAssetList> {
  const payload = await requestJson("/v1/public/assets", query);
  assertCursorList(payload, assertAssetCard);
  return payload as PublicAssetList;
}

export async function getPublicAsset(referenceCode: string): Promise<PublicAssetDetail> {
  if (!/^SJ-[A-Z0-9]{8}$/u.test(referenceCode)) {
    throw new PublicApiError(404, "ASSET_NOT_FOUND", "Aset tidak tersedia.");
  }
  const payload = await requestJson(`/v1/public/assets/${encodeURIComponent(referenceCode)}`);
  assertAssetDetail(payload);
  return payload;
}

export async function listPublicInstitutions(query: InstitutionListQuery = {}): Promise<PublicInstitutionList> {
  const payload = await requestJson("/v1/public/institutions", query);
  assertCursorList(payload, assertInstitution);
  return payload as PublicInstitutionList;
}

export async function listAllPublicInstitutions(): Promise<PublicInstitution[]> {
  const items: PublicInstitution[] = [];
  const seenCursors = new Set<string>();
  let cursor: string | undefined;
  for (let page = 0; page < 1_000; page += 1) {
    const result = await listPublicInstitutions({ limit: 100, cursor });
    items.push(...result.items);
    if (!result.next_cursor) return items;
    if (seenCursors.has(result.next_cursor)) {
      throw new PublicApiError(502, "PUBLIC_CURSOR_REPEATED", "Daftar BPRS tidak dapat dilanjutkan dengan aman.");
    }
    seenCursors.add(result.next_cursor);
    cursor = result.next_cursor;
  }
  throw new PublicApiError(502, "PUBLIC_DIRECTORY_TOO_LARGE", "Daftar BPRS melebihi batas pengambilan aman.");
}

export async function getPublicInstitution(publicSlug: string): Promise<PublicInstitution> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(publicSlug)) {
    throw new PublicApiError(404, "INSTITUTION_NOT_FOUND", "BPRS penerbit tidak tersedia.");
  }
  const payload = await requestJson(`/v1/public/institutions/${encodeURIComponent(publicSlug)}`);
  assertInstitution(payload);
  return payload;
}

export async function getPublicTaxonomy(): Promise<PublicTaxonomy> {
  const payload = await requestJson("/v1/public/taxonomy");
  if (!isObject(payload) || payload.version !== 1 || !isObject(payload.categories) || !isObject(payload.vocabularies)) {
    throw new PublicApiError(502, "PUBLIC_RESPONSE_INVALID", "Taksonomi katalog tidak valid.");
  }
  return payload as PublicTaxonomy;
}

export function referenceCodeFromSlug(slug: string) {
  const referenceCode = decodeURIComponent(slug).toLocaleUpperCase("en-US");
  return /^SJ-[A-Z0-9]{8}$/u.test(referenceCode) ? referenceCode : null;
}

export function isPublicNotFound(error: unknown) {
  return error instanceof PublicApiError && error.status === 404;
}

export function publicDataStateKind(error: unknown): "error" | "timeout" {
  return error instanceof PublicApiError && error.code === "PUBLIC_API_TIMEOUT" ? "timeout" : "error";
}
