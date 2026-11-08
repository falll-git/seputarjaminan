import { randomInt } from "node:crypto";
import {
  PUBLICATION_CATEGORIES,
  PUBLIC_ATTRIBUTE_VOCABULARIES,
} from "@seputarjaminan/contracts";
import type { DatabaseClients } from "./database.js";
import { ApiError } from "./errors.js";
import { assertQueryKeys, cursorScope, decodePublicCursor, encodePublicCursor, normalizeLocation } from "./public-query.js";

const MESSAGE_TEMPLATE = "Siang Pak/Bu, saya ingin mengetahui informasi lebih lanjut terkait aset {reference_code} — {asset_title}.";
const VALID_CATEGORIES = new Set(Object.keys(PUBLICATION_CATEGORIES));
const VALID_SUBCATEGORIES = new Set(Object.values(PUBLICATION_CATEGORIES).flat());

function queryText(query: Record<string, unknown>, name: string, maxLength: number) {
  const value = query[name];
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.trim().length < 1 || value.trim().length > maxLength) {
    throw new ApiError(400, "FILTER_INVALID", `Filter ${name} tidak valid.`);
  }
  return value.trim();
}

function queryLimit(query: Record<string, unknown>) {
  if (query.limit === undefined) return 24;
  if (typeof query.limit !== "string" || !/^\d{1,3}$/u.test(query.limit)) {
    throw new ApiError(400, "LIMIT_INVALID", "Jumlah data per halaman tidak valid.");
  }
  const value = Number(query.limit);
  if (value < 1 || value > 100) throw new ApiError(400, "LIMIT_INVALID", "Jumlah data per halaman harus 1 sampai 100.");
  return value;
}

function normalizeSearch(value?: string) {
  return value?.normalize("NFKC").toLocaleLowerCase("id-ID");
}

function publicMediaUrl(baseUrl: string, mediaId: string) {
  return baseUrl.replace(/\/$/, "") + "/" + mediaId;
}

function attributesFor(publication: any): Record<string, string | number> {
  if (publication.category === "TANAH" && publication.landDetail) {
    return {
      land_area_m2: Number(publication.landDetail.landAreaM2),
      ...(publication.landDetail.contour ? { contour: publication.landDetail.contour } : {}),
      ...(publication.landDetail.roadAccess ? { road_access: publication.landDetail.roadAccess } : {}),
    };
  }
  if (publication.category === "BANGUNAN" && publication.buildingDetail) {
    return {
      ...(publication.buildingDetail.landAreaM2 != null
        ? { land_area_m2: Number(publication.buildingDetail.landAreaM2) }
        : {}),
      building_area_m2: Number(publication.buildingDetail.buildingAreaM2),
      ...(publication.buildingDetail.floorCount != null
        ? { floor_count: publication.buildingDetail.floorCount }
        : {}),
      ...(publication.buildingDetail.publicUsage
        ? { public_usage: publication.buildingDetail.publicUsage }
        : {}),
    };
  }
  if (publication.category === "MESIN_PERALATAN" && publication.machineDetail) {
    return {
      ...(publication.machineDetail.brandOrManufacturer
        ? { brand_or_manufacturer: publication.machineDetail.brandOrManufacturer }
        : {}),
      model_or_type: publication.machineDetail.modelOrType,
      ...(publication.machineDetail.manufactureYear != null
        ? { manufacture_year: publication.machineDetail.manufactureYear }
        : {}),
      ...(publication.machineDetail.publicCapacity
        ? { public_capacity: publication.machineDetail.publicCapacity }
        : {}),
      public_condition: publication.machineDetail.publicCondition,
    };
  }
  if (publication.category !== "KENDARAAN" || !publication.vehicleDetail) return {};
  return {
    brand: publication.vehicleDetail.brand,
    model_or_type: publication.vehicleDetail.modelOrType,
    ...(publication.vehicleDetail.manufactureYear != null
      ? { manufacture_year: publication.vehicleDetail.manufactureYear }
      : {}),
    ...(publication.vehicleDetail.transmission
      ? { transmission: publication.vehicleDetail.transmission }
      : {}),
    ...(publication.vehicleDetail.fuelType
      ? { fuel_type: publication.vehicleDetail.fuelType }
      : {}),
    ...(publication.vehicleDetail.mileageKm != null
      ? { mileage_km: Number(publication.vehicleDetail.mileageKm) }
      : {}),
    public_condition: publication.vehicleDetail.publicCondition,
  };
}

export function visibilityWhere(now: Date) {
  return {
    state: "PUBLISHED" as const,
    availability: "AVAILABLE" as const,
    nextReconfirmationAt: { gt: now },
    institution: { state: "ACTIVE" as const },
    profile: { state: "ACTIVE" as const },
    whatsappContact: { state: "VERIFIED" as const },
    media: {
      some: { isCover: true, mediaObject: { state: "READY" as const } },
    },
  };
}

const publicInclude = {
  institution: true,
  profile: { include: { publicMark: true } },
  whatsappContact: true,
  media: {
    where: { mediaObject: { state: "READY" as const } },
    orderBy: { sortOrder: "asc" as const },
    include: { mediaObject: true },
  },
  landDetail: true,
  buildingDetail: true,
  machineDetail: true,
  vehicleDetail: true,
};

export class PublicService {
  constructor(
    private databases: DatabaseClients,
    private storage: any,
    private mediaBaseUrl: string,
    private websiteOrigin?: string,
  ) {}

  private card(publication: any) {
    const cover = publication.media.find((item: any) => item.isCover);
    return {
      reference_code: publication.publicReferenceCode,
      title: publication.title,
      category: publication.category,
      subcategory: publication.subcategoryCode,
      location: {
        city_regency: publication.cityRegency,
        province: publication.province,
      },
      cover: {
        url: publicMediaUrl(this.mediaBaseUrl, cover.mediaObject.id),
        width: cover.mediaObject.deliveryWidth,
        height: cover.mediaObject.deliveryHeight,
        alt_text: cover.altText,
      },
      institution: {
        public_slug: publication.institution.publicSlug,
        public_name: publication.profile.publicName,
        public_mark_url: publicMediaUrl(this.mediaBaseUrl, publication.profile.publicMarkMediaId),
      },
      availability: publication.availability,
      photo_count: publication.media.length,
      public_updated_at: publication.publicUpdatedAt.toISOString(),
      summary_attributes: this.summaryAttributes(publication),
    };
  }

  private summaryAttributes(publication: any) {
    const keys: Record<string, string[]> = {
      TANAH: ["land_area_m2"], BANGUNAN: ["land_area_m2", "building_area_m2"],
      MESIN_PERALATAN: ["brand_or_manufacturer", "model_or_type"],
      KENDARAAN: ["model_or_type", "mileage_km"],
    };
    const attributes = attributesFor(publication) as Record<string, string | number>;
    return Object.fromEntries((keys[publication.category] ?? [])
      .filter(key => attributes[key] != null).map(key => [key, attributes[key]]));
  }

  async listAssets(query: Record<string, unknown>) {
    assertQueryKeys(query, ["limit", "sort", "cursor", "category", "subcategory", "province", "city_regency", "institution", "q"]);
    const limit = queryLimit(query);
    const sort = queryText(query, "sort", 10);
    if (sort && !["NEWEST", "OLDEST"].includes(sort)) throw new ApiError(400, "SORT_INVALID", "Urutan katalog tidak valid.");
    const direction = sort === "OLDEST" ? "asc" : "desc";
    const cursorValue = queryText(query, "cursor", 1000);
    const category = queryText(query, "category", 40);
    if (category && !VALID_CATEGORIES.has(category)) throw new ApiError(400, "CATEGORY_INVALID", "Kategori aset tidak valid.");
    const subcategory = queryText(query, "subcategory", 60);
    if (subcategory && !VALID_SUBCATEGORIES.has(subcategory)) throw new ApiError(400, "SUBCATEGORY_INVALID", "Subkategori aset tidak valid.");
    if (category && subcategory && !PUBLICATION_CATEGORIES[category].includes(subcategory)) {
      throw new ApiError(400, "SUBCATEGORY_INVALID", "Subkategori tidak sesuai jenis aset.");
    }
    const province = normalizeLocation(queryText(query, "province", 100));
    const cityRegency = normalizeLocation(queryText(query, "city_regency", 100));
    const institution = queryText(query, "institution", 100);
    if (institution && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(institution)) throw new ApiError(400, "INSTITUTION_FILTER_INVALID", "Filter BPRS tidak valid.");
    const search = normalizeSearch(queryText(query, "q", 100));
    const scope = cursorScope(["assets", sort ?? "NEWEST", category, subcategory, normalizeSearch(province), normalizeSearch(cityRegency), institution, search]);
    const position = decodePublicCursor(cursorValue, scope, "asset");
    const cursor = position ? { id: position.id, updatedAt: new Date(position.updated_at) } : null;
    const now = new Date();
    const cursorWhere = cursor
      ? direction === "desc"
        ? {
            OR: [
              { publicUpdatedAt: { lt: cursor.updatedAt } },
              { publicUpdatedAt: cursor.updatedAt, id: { lt: cursor.id } },
            ],
          }
        : {
            OR: [
              { publicUpdatedAt: { gt: cursor.updatedAt } },
              { publicUpdatedAt: cursor.updatedAt, id: { gt: cursor.id } },
            ],
          }
      : {};
    const rows = await this.databases.publicRead.publication.findMany({
      where: {
        ...visibilityWhere(now),
        ...cursorWhere,
        ...(category ? { category: category as any } : {}),
        ...(subcategory ? { subcategoryCode: subcategory } : {}),
        ...(province ? { province: { equals: province, mode: "insensitive" as const } } : {}),
        ...(cityRegency ? { cityRegency: { equals: cityRegency, mode: "insensitive" as const } } : {}),
        ...(search ? { searchDocument: { normalizedText: { contains: search } } } : {}),
        ...(institution
          ? { institution: { state: "ACTIVE", publicSlug: institution } }
          : {}),
      },
      orderBy: [{ publicUpdatedAt: direction }, { id: direction }],
      take: limit + 1,
      include: publicInclude,
    });
    const hasNext = rows.length > limit;
    const items = rows.slice(0, limit);
    const last = items.at(-1);
    return {
      items: items.map((row) => this.card(row)),
      next_cursor: hasNext && last ? encodePublicCursor(scope, { updated_at: last.publicUpdatedAt.toISOString(), id: last.id }) : null,
    };
  }

  async showcase(query: Record<string, unknown>) {
    assertQueryKeys(query, []);
    // Sample the whole eligible population without loading every card. A bounded
    // eight ID lookups plus a batch DTO read; no per-card detail HTTP requests.
    return this.databases.publicRead.$transaction(async tx => {
      const where = visibilityWhere(new Date());
      const count = await tx.publication.count({ where });
      const positions = new Map<number, number>();
      const ids: string[] = [];
      for (let index = 0; index < Math.min(8, count); index++) {
        const remaining = count - index;
        const draw = randomInt(remaining);
        const offset = positions.get(draw) ?? draw;
        positions.set(draw, positions.get(remaining - 1) ?? remaining - 1);
        const [row] = await tx.publication.findMany({ where, orderBy: { id: "asc" }, skip: offset, take: 1, select: { id: true } });
        if (row) ids.push(row.id);
      }
      const rows = ids.length ? await tx.publication.findMany({ where: { ...visibilityWhere(new Date()), id: { in: ids } }, include: publicInclude }) : [];
      const byId = new Map(rows.map(row => [row.id, row]));
      return { items: ids.flatMap(id => { const row = byId.get(id); return row ? [this.card(row)] : []; }), next_cursor: null };
    }, { isolationLevel: "RepeatableRead", timeout: 4500 });
  }

  async getAsset(referenceCode: string) {
    if (!/^SJ-[A-Z0-9]{8}$/u.test(referenceCode)) throw new ApiError(404, "ASSET_NOT_FOUND", "Aset tidak tersedia.");
    const publication = await this.databases.publicRead.publication.findFirst({
      where: { publicReferenceCode: referenceCode, ...visibilityWhere(new Date()) },
      include: publicInclude,
    });
    if (!publication) throw new ApiError(404, "ASSET_NOT_FOUND", "Aset tidak tersedia.");
    const template = MESSAGE_TEMPLATE
      .replace("{reference_code}", publication.publicReferenceCode)
      .replace("{asset_title}", publication.title);
    const phone = publication.whatsappContact.phoneE164.replace(/^\+/, "");
    return {
      ...this.card(publication),
      // SJ applied event version, not the bank draft revision.
      public_asset_version: publication.aggregateVersion,
      public_page_url: this.websiteOrigin ? new URL(`/aset/${encodeURIComponent(publication.publicReferenceCode)}`, this.websiteOrigin).href : null,
      description: publication.description,
      attributes: attributesFor(publication),
      media: publication.media.map((item) => ({
        url: publicMediaUrl(this.mediaBaseUrl, item.mediaObject.id),
        width: item.mediaObject.deliveryWidth,
        height: item.mediaObject.deliveryHeight,
        alt_text: item.altText,
      })),
      whatsapp_url: "https://wa.me/" + phone + "?text=" + encodeURIComponent(template),
    };
  }

  async listInstitutions(query: Record<string, unknown>) {
    assertQueryKeys(query, ["limit", "cursor", "q", "province"]);
    const limit = queryLimit(query);
    const search = queryText(query, "q", 100);
    const province = normalizeLocation(queryText(query, "province", 100));
    const scope = cursorScope(["institutions", search?.toLocaleLowerCase("id-ID"), normalizeSearch(province)]);
    const cursor = decodePublicCursor(queryText(query, "cursor", 1000), scope, "institution")?.public_slug;
    const now = new Date();
    const rows = await this.databases.publicRead.institution.findMany({
      where: {
        state: "ACTIVE",
        ...(cursor ? { publicSlug: { gt: cursor } } : {}),
        profile: {
          state: "ACTIVE",
          ...(province ? { officeProvince: { equals: province, mode: "insensitive" } } : {}),
          ...(search
            ? {
                OR: [
                  { publicName: { contains: search, mode: "insensitive" } },
                  { officeCityRegency: { contains: search, mode: "insensitive" } },
                  { officeProvince: { contains: search, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        publications: { some: visibilityWhere(now) },
      },
      orderBy: [{ publicSlug: "asc" }],
      take: limit + 1,
      include: { profile: true },
    });
    const hasNext = rows.length > limit;
    const items = rows.slice(0, limit);
    // Count only this bounded page in one batch. Including filtered counts in
    // findMany caused repeated visibility aggregates before pagination in PG.
    const counts = items.length ? await this.databases.publicRead.publication.groupBy({
      by: ["institutionId"],
      where: { ...visibilityWhere(now), institutionId: { in: items.map((item) => item.id) } },
      _count: { _all: true },
    }) : [];
    const countByInstitution = new Map(counts.map((item) => [item.institutionId, item._count._all]));
    return {
      items: items.map((institution) => ({
        public_slug: institution.publicSlug,
        public_name: institution.profile!.publicName,
        public_mark_url: publicMediaUrl(this.mediaBaseUrl, institution.profile!.publicMarkMediaId),
        short_description: institution.profile!.shortDescription,
        office_city_regency: institution.profile!.officeCityRegency,
        office_province: institution.profile!.officeProvince,
        published_asset_count: countByInstitution.get(institution.id) ?? 0,
      })),
      next_cursor: hasNext && items.length > 0 ? encodePublicCursor(scope, { public_slug: items.at(-1)!.publicSlug }) : null,
    };
  }

  async getInstitution(publicSlug: string) {
    if (publicSlug.length > 100 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(publicSlug)) throw new ApiError(404, "INSTITUTION_NOT_FOUND", "BPRS penerbit tidak tersedia.");
    const institution = await this.databases.publicRead.institution.findFirst({
      where: { publicSlug, state: "ACTIVE", profile: { state: "ACTIVE" } },
      include: {
        profile: true,
        _count: { select: { publications: { where: visibilityWhere(new Date()) } } },
      },
    });
    if (!institution?.profile) {
      throw new ApiError(404, "INSTITUTION_NOT_FOUND", "BPRS penerbit tidak tersedia.");
    }
    return {
      public_slug: institution.publicSlug,
      public_name: institution.profile.publicName,
      public_mark_url: publicMediaUrl(this.mediaBaseUrl, institution.profile.publicMarkMediaId),
      short_description: institution.profile.shortDescription,
      office_city_regency: institution.profile.officeCityRegency,
      office_province: institution.profile.officeProvince,
      published_asset_count: institution._count.publications,
      // Source event version, not approval state or the bank's draft revision.
      public_profile_version: institution.profile.sourceVersion,
      public_page_url: this.websiteOrigin ? new URL(`/bprs/${encodeURIComponent(institution.publicSlug)}`, this.websiteOrigin).href : null,
    };
  }

  taxonomy() {
    return {
      version: 1,
      categories: PUBLICATION_CATEGORIES,
      vocabularies: PUBLIC_ATTRIBUTE_VOCABULARIES,
    };
  }

  async readMedia(mediaId: string, query: Record<string, unknown> = {}) {
    assertQueryKeys(query, ["variant"]);
    const variant = queryText(query, "variant", 10) ?? "main";
    if (!["main", "card", "thumb"].includes(variant)) throw new ApiError(400, "MEDIA_VARIANT_INVALID", "Ukuran gambar tidak dikenali.");
    if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/iu.test(mediaId)) throw new ApiError(404, "MEDIA_NOT_FOUND", "Gambar tidak tersedia.");
    const media = await this.databases.publicRead.mediaObject.findFirst({
      where: {
        id: mediaId,
        state: "READY",
        OR: [
          { profileMarks: { some: { state: "ACTIVE", institution: { state: "ACTIVE" } } } },
          { publicationMedia: { some: { publication: visibilityWhere(new Date()) } } },
        ],
      },
    });
    if (!media) throw new ApiError(404, "MEDIA_NOT_FOUND", "Gambar tidak tersedia.");
    const prefix = ["institutions", media.institutionId, "media", media.id].join("/");
    if (media.deliveryObjectKey !== prefix + "/main" || media.deliveryMime !== "image/webp") {
      throw new ApiError(404, "MEDIA_NOT_READY", "Gambar belum siap ditampilkan.");
    }
    // Older processed media can use their existing safe main derivative. Never
    // substitute an original or hide a missing variant that was recorded ready.
    const derivatives = media.derivativeMetadata as Record<string, unknown> | null;
    const key = variant !== "main" && derivatives?.[variant] ? prefix + "/" + variant : media.deliveryObjectKey;
    try {
      const object = await this.storage.readObject(key);
      return { ...object, contentType: media.deliveryMime };
    } catch (error) {
      if ((error as { code?: string }).code === "ENOENT") throw new ApiError(404, "MEDIA_NOT_FOUND", "Gambar tidak tersedia.");
      throw new ApiError(503, "MEDIA_STORAGE_UNAVAILABLE", "Penyimpanan gambar belum tersedia.", { retryable: true });
    }
  }
}
