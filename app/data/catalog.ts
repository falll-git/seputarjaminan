import type {
  PublicAssetCard,
  PublicAssetDetail,
  PublicInstitution,
  PublicTaxonomy,
} from "@seputarjaminan/contracts";
import { toSameOriginPublicMediaUrl } from "../lib/public-media";

export type CategoryCode = "TANAH" | "BANGUNAN" | "MESIN_PERALATAN" | "KENDARAAN";
export type CategorySlug = "tanah" | "bangunan" | "mesin-peralatan" | "kendaraan";

export type Category = {
  code: CategoryCode;
  slug: CategorySlug;
  label: string;
  index: string;
  description: string;
  subtypes: string[];
};

export type BprsSummary = {
  slug: string;
  name: string;
  markUrl: string;
};

export type BprsProfile = BprsSummary & {
  city: string;
  province: string;
  description: string;
  publishedAssetCount: number;
};

export type AssetMedia = {
  url: string;
  width: number;
  height: number;
  altText: string;
};

export type AssetSpec = { label: string; value: string };

export type Asset = {
  id: string;
  slug: string;
  title: string;
  categoryCode: CategoryCode;
  category: CategorySlug;
  categoryLabel: string;
  subtypeCode: string;
  subtype: string;
  city: string;
  province: string;
  publisher: BprsSummary;
  status: "Tersedia";
  photoCount: number;
  updatedAt: string;
  cover: AssetMedia;
};

export type AssetDetail = Asset & {
  gallery: AssetMedia[];
  description: string;
  specs: AssetSpec[];
  whatsappUrl: string;
};

const CATEGORY_PRESENTATION: Record<CategoryCode, Omit<Category, "subtypes">> = {
  TANAH: {
    code: "TANAH",
    slug: "tanah",
    label: "Tanah",
    index: "01",
    description: "Bidang tanah yang dipublikasikan langsung oleh BPRS penerbit.",
  },
  BANGUNAN: {
    code: "BANGUNAN",
    slug: "bangunan",
    label: "Bangunan",
    index: "02",
    description: "Rumah, ruko, kios, kantor, gudang, dan pabrik.",
  },
  MESIN_PERALATAN: {
    code: "MESIN_PERALATAN",
    slug: "mesin-peralatan",
    label: "Mesin dan Peralatan",
    index: "03",
    description: "Mesin serta peralatan untuk kegiatan produktif dan industri.",
  },
  KENDARAAN: {
    code: "KENDARAAN",
    slug: "kendaraan",
    label: "Kendaraan",
    index: "04",
    description: "Mobil, motor, truk, dan bus.",
  },
};

const ATTRIBUTE_LABELS: Record<string, string> = {
  land_area_m2: "Luas tanah",
  contour: "Kontur",
  road_access: "Akses jalan",
  building_area_m2: "Luas bangunan",
  floor_count: "Jumlah lantai",
  public_usage: "Peruntukan",
  brand_or_manufacturer: "Merek atau produsen",
  model_or_type: "Model atau tipe",
  manufacture_year: "Tahun pembuatan",
  public_capacity: "Kapasitas",
  public_condition: "Kondisi",
  brand: "Merek",
  transmission: "Transmisi",
  fuel_type: "Bahan bakar",
  mileage_km: "Jarak tempuh",
};

const AREA_ATTRIBUTES = new Set(["land_area_m2", "building_area_m2"]);

export function humanizeCode(value: string) {
  return value
    .toLocaleLowerCase("id-ID")
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toLocaleUpperCase("id-ID") + part.slice(1))
    .join(" ");
}

export function categoryCodeFromSlug(slug: string): CategoryCode | undefined {
  return Object.values(CATEGORY_PRESENTATION).find((item) => item.slug === slug)?.code;
}

export function getCategoryPresentation(code: string) {
  return CATEGORY_PRESENTATION[code as CategoryCode];
}

function requireCategory(code: string) {
  const category = getCategoryPresentation(code);
  if (!category) throw new Error(`Kategori publik tidak dikenali: ${code}`);
  return category;
}

function toMedia(media: PublicAssetCard["cover"]): AssetMedia {
  return {
    url: toSameOriginPublicMediaUrl(media.url),
    width: media.width,
    height: media.height,
    altText: media.alt_text,
  };
}

function toPublisher(institution: PublicAssetCard["institution"]): BprsSummary {
  return {
    slug: institution.public_slug,
    name: institution.public_name,
    markUrl: toSameOriginPublicMediaUrl(institution.public_mark_url),
  };
}

export function toAsset(card: PublicAssetCard): Asset {
  const category = requireCategory(card.category);
  return {
    id: card.reference_code,
    slug: card.reference_code.toLocaleLowerCase("en-US"),
    title: card.title,
    categoryCode: category.code,
    category: category.slug,
    categoryLabel: category.label,
    subtypeCode: card.subcategory,
    subtype: humanizeCode(card.subcategory),
    city: card.location.city_regency,
    province: card.location.province,
    publisher: toPublisher(card.institution),
    status: card.availability === "AVAILABLE" ? "Tersedia" : neverAvailability(card.availability),
    photoCount: card.photo_count,
    updatedAt: card.public_updated_at,
    cover: toMedia(card.cover),
  };
}

function neverAvailability(value: never): never {
  throw new Error(`Status publik tidak dikenali: ${String(value)}`);
}

function formatAttributeValue(key: string, value: string | number) {
  if (AREA_ATTRIBUTES.has(key) && typeof value === "number") return `${new Intl.NumberFormat("id-ID").format(value)} m²`;
  if (key === "mileage_km" && typeof value === "number") return `${new Intl.NumberFormat("id-ID").format(value)} km`;
  if (key === "floor_count" && typeof value === "number") return `${value} lantai`;
  if (typeof value === "string" && /^[A-Z0-9_]+$/u.test(value)) return humanizeCode(value);
  return String(value);
}

export function toAssetDetail(detail: PublicAssetDetail): AssetDetail {
  return {
    ...toAsset(detail),
    gallery: detail.media.map(toMedia),
    description: detail.description,
    specs: Object.entries(detail.attributes).map(([key, value]) => ({
      label: ATTRIBUTE_LABELS[key] ?? humanizeCode(key),
      value: formatAttributeValue(key, value),
    })),
    whatsappUrl: detail.whatsapp_url,
  };
}

export function toBprsProfile(profile: PublicInstitution): BprsProfile {
  return {
    slug: profile.public_slug,
    name: profile.public_name,
    markUrl: toSameOriginPublicMediaUrl(profile.public_mark_url),
    city: profile.office_city_regency,
    province: profile.office_province,
    description: profile.short_description,
    publishedAssetCount: profile.published_asset_count,
  };
}

export function categoriesFromTaxonomy(taxonomy: PublicTaxonomy): Category[] {
  return Object.entries(taxonomy.categories)
    .map(([code, subtypes]) => {
      const presentation = getCategoryPresentation(code);
      return presentation ? { ...presentation, subtypes: subtypes.map(humanizeCode) } : null;
    })
    .filter((category): category is Category => category !== null)
    .sort((left, right) => left.index.localeCompare(right.index));
}

export function formatPublicDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Tanggal pembaruan tidak tersedia";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(parsed);
}

export function initialsFor(name: string) {
  const words = name.replace(/^BPRS\s+/iu, "").trim().split(/\s+/u).filter(Boolean);
  return words.slice(0, 2).map((word) => word[0]?.toLocaleUpperCase("id-ID") ?? "").join("") || "BPRS";
}
