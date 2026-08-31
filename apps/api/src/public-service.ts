import {
  PUBLICATION_CATEGORIES,
  PUBLIC_ATTRIBUTE_VOCABULARIES,
} from "@seputarjaminan/contracts";
import type { DatabaseClients } from "./database.js";
import { ApiError } from "./errors.js";

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

function encodeCursor(value: { updatedAt: Date; id: string }) {
  return Buffer.from(JSON.stringify({
    updated_at: value.updatedAt.toISOString(),
    id: value.id,
  }), "utf8").toString("base64url");
}

function decodeCursor(value?: string) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    const updatedAt = new Date(parsed.updated_at);
    if (!parsed.id || Number.isNaN(updatedAt.getTime())) throw new Error("invalid");
    return { updatedAt, id: String(parsed.id) };
  } catch {
    throw new ApiError(400, "CURSOR_INVALID", "Halaman katalog tidak valid. Silakan mulai dari awal.");
  }
}

function encodeInstitutionCursor(publicSlug: string) {
  return Buffer.from(JSON.stringify({ public_slug: publicSlug }), "utf8").toString("base64url");
}

function decodeInstitutionCursor(value?: string) {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (typeof parsed.public_slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(parsed.public_slug)) {
      throw new Error("invalid");
    }
    return parsed.public_slug as string;
  } catch {
    throw new ApiError(400, "CURSOR_INVALID", "Halaman BPRS penerbit tidak valid. Silakan mulai dari awal.");
  }
}

function publicMediaUrl(baseUrl: string, mediaId: string) {
  return baseUrl.replace(/\/$/, "") + "/" + mediaId;
}

function attributesFor(publication: any) {
  if (publication.landDetail) {
    return {
      land_area_m2: Number(publication.landDetail.landAreaM2),
      ...(publication.landDetail.contour ? { contour: publication.landDetail.contour } : {}),
      ...(publication.landDetail.roadAccess ? { road_access: publication.landDetail.roadAccess } : {}),
    };
  }
  if (publication.buildingDetail) {
    return {
      ...(publication.buildingDetail.landAreaM2
        ? { land_area_m2: Number(publication.buildingDetail.landAreaM2) }
        : {}),
      building_area_m2: Number(publication.buildingDetail.buildingAreaM2),
      ...(publication.buildingDetail.floorCount
        ? { floor_count: publication.buildingDetail.floorCount }
        : {}),
      ...(publication.buildingDetail.publicUsage
        ? { public_usage: publication.buildingDetail.publicUsage }
        : {}),
    };
  }
  if (publication.machineDetail) {
    return {
      ...(publication.machineDetail.brandOrManufacturer
        ? { brand_or_manufacturer: publication.machineDetail.brandOrManufacturer }
        : {}),
      model_or_type: publication.machineDetail.modelOrType,
      ...(publication.machineDetail.manufactureYear
        ? { manufacture_year: publication.machineDetail.manufactureYear }
        : {}),
      ...(publication.machineDetail.publicCapacity
        ? { public_capacity: publication.machineDetail.publicCapacity }
        : {}),
      public_condition: publication.machineDetail.publicCondition,
    };
  }
  return {
    brand: publication.vehicleDetail.brand,
    model_or_type: publication.vehicleDetail.modelOrType,
    ...(publication.vehicleDetail.manufactureYear
      ? { manufacture_year: publication.vehicleDetail.manufactureYear }
      : {}),
    ...(publication.vehicleDetail.transmission
      ? { transmission: publication.vehicleDetail.transmission }
      : {}),
    ...(publication.vehicleDetail.fuelType
      ? { fuel_type: publication.vehicleDetail.fuelType }
      : {}),
    ...(publication.vehicleDetail.mileageKm
      ? { mileage_km: Number(publication.vehicleDetail.mileageKm) }
      : {}),
    public_condition: publication.vehicleDetail.publicCondition,
  };
}

function visibilityWhere(now: Date) {
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
    };
  }

  async listAssets(query: Record<string, unknown>) {
    const limit = queryLimit(query);
    const sort = queryText(query, "sort", 10);
    if (sort && !["NEWEST", "OLDEST"].includes(sort)) throw new ApiError(400, "SORT_INVALID", "Urutan katalog tidak valid.");
    const direction = sort === "OLDEST" ? "asc" : "desc";
    const cursorValue = queryText(query, "cursor", 1000);
    const cursor = decodeCursor(cursorValue);
    const category = queryText(query, "category", 40);
    if (category && !VALID_CATEGORIES.has(category)) throw new ApiError(400, "CATEGORY_INVALID", "Kategori aset tidak valid.");
    const subcategory = queryText(query, "subcategory", 60);
    if (subcategory && !VALID_SUBCATEGORIES.has(subcategory)) throw new ApiError(400, "SUBCATEGORY_INVALID", "Subkategori aset tidak valid.");
    const province = queryText(query, "province", 100);
    const cityRegency = queryText(query, "city_regency", 100);
    const institution = queryText(query, "institution", 100);
    if (institution && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(institution)) throw new ApiError(400, "INSTITUTION_FILTER_INVALID", "Filter BPRS tidak valid.");
    const search = normalizeSearch(queryText(query, "q", 100));
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
        ...(province ? { province } : {}),
        ...(cityRegency ? { cityRegency } : {}),
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
      next_cursor: hasNext && last ? encodeCursor({ updatedAt: last.publicUpdatedAt, id: last.id }) : null,
    };
  }

  async getAsset(referenceCode: string) {
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
    const limit = queryLimit(query);
    const cursor = decodeInstitutionCursor(queryText(query, "cursor", 1000));
    const search = queryText(query, "q", 100);
    const province = queryText(query, "province", 100);
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
        publications: { some: visibilityWhere(new Date()) },
      },
      orderBy: [{ publicSlug: "asc" }],
      take: limit + 1,
      include: {
        profile: true,
        _count: { select: { publications: { where: visibilityWhere(new Date()) } } },
      },
    });
    const hasNext = rows.length > limit;
    const items = rows.slice(0, limit);
    return {
      items: items.map((institution) => ({
        public_slug: institution.publicSlug,
        public_name: institution.profile!.publicName,
        public_mark_url: publicMediaUrl(this.mediaBaseUrl, institution.profile!.publicMarkMediaId),
        short_description: institution.profile!.shortDescription,
        office_city_regency: institution.profile!.officeCityRegency,
        office_province: institution.profile!.officeProvince,
        published_asset_count: institution._count.publications,
      })),
      next_cursor: hasNext && items.length > 0 ? encodeInstitutionCursor(items.at(-1)!.publicSlug) : null,
    };
  }

  async getInstitution(publicSlug: string) {
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
    };
  }

  taxonomy() {
    return {
      version: 1,
      categories: PUBLICATION_CATEGORIES,
      vocabularies: PUBLIC_ATTRIBUTE_VOCABULARIES,
    };
  }

  async readMedia(mediaId: string) {
    const media = await this.databases.publicRead.mediaObject.findFirst({
      where: {
        id: mediaId,
        state: "READY",
        OR: [
          { profileMarks: { some: { state: "ACTIVE" } } },
          { publicationMedia: { some: { publication: visibilityWhere(new Date()) } } },
        ],
      },
    });
    if (!media) throw new ApiError(404, "MEDIA_NOT_FOUND", "Gambar tidak tersedia.");
    if (!media.deliveryObjectKey || !media.deliveryMime) {
      throw new ApiError(404, "MEDIA_NOT_READY", "Gambar belum siap ditampilkan.");
    }
    const object = await this.storage.readObject(media.deliveryObjectKey);
    return { ...object, contentType: media.deliveryMime };
  }
}
