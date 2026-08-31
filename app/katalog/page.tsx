import type { Metadata } from "next";
import CatalogClient from "../components/CatalogClient";
import PageIntro from "../components/PageIntro";
import PublicDataState from "../components/PublicDataState";
import SiteFooter from "../components/SiteFooter";
import SiteHeader from "../components/SiteHeader";
import {
  categoriesFromTaxonomy,
  categoryCodeFromSlug,
  toAsset,
  toBprsProfile,
} from "../data/catalog";
import {
  getPublicTaxonomy,
  listAllPublicInstitutions,
  listPublicAssets,
  publicDataStateKind,
} from "../lib/public-api";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Katalog aset | Seputar Jaminan by ruwang",
  description: "Telusuri katalog publik aset yang diterbitkan oleh BPRS melalui ruwang.",
};

type CatalogPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value?: string | string[]) {
  return (Array.isArray(value) ? value[0] ?? "" : value ?? "").trim();
}

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const params = searchParams ? await searchParams : {};
  const categorySlug = firstValue(params.category);
  const category = categoryCodeFromSlug(categorySlug);
  const institution = firstValue(params.bprs);
  const query = firstValue(params.q).slice(0, 100);
  const province = firstValue(params.province).slice(0, 100);
  const cursor = firstValue(params.cursor).slice(0, 1_000);
  const sort = firstValue(params.sort) === "terlama" ? "OLDEST" as const : "NEWEST" as const;

  const [assetsResult, taxonomyResult, institutionsResult] = await Promise.allSettled([
    listPublicAssets({
      limit: 24,
      sort,
      ...(query ? { q: query } : {}),
      ...(category ? { category } : {}),
      ...(province ? { province } : {}),
      ...(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(institution) ? { institution } : {}),
      ...(cursor ? { cursor } : {}),
    }),
    getPublicTaxonomy(),
    listAllPublicInstitutions(),
  ]);

  const assets = assetsResult.status === "fulfilled" ? assetsResult.value.items.map(toAsset) : [];
  const categories = taxonomyResult.status === "fulfilled" ? categoriesFromTaxonomy(taxonomyResult.value) : [];
  const publishers = institutionsResult.status === "fulfilled" ? institutionsResult.value.map(toBprsProfile) : [];
  const provinces = Array.from(new Set([
    ...assets.map((asset) => asset.province),
    ...publishers.map((publisher) => publisher.province),
    ...(province ? [province] : []),
  ].map((value) => value.trim()).filter(Boolean))).sort((left, right) => left.localeCompare(right, "id-ID"));
  const assetStateKind = assetsResult.status === "rejected" ? publicDataStateKind(assetsResult.reason) : "empty";

  return (
    <>
      <SiteHeader />
      <main>
        <div className="catalog-masthead">
          <PageIntro
            index="01"
            eyebrow="Katalog publik"
            title="Cari aset yang sesuai kebutuhan."
            description="Telusuri aset berdasarkan kata kunci, kategori, lokasi, atau BPRS penerbit. Harga dan ketersediaan terbaru dikonfirmasi langsung kepada BPRS."
            aside={assetsResult.status === "fulfilled"
              ? <><strong>{String(assets.length).padStart(2, "0")}</strong><span>aset ditampilkan pada halaman ini</span></>
              : <><strong>—</strong><span>data halaman belum tersedia</span></>}
          />
        </div>
        {assetsResult.status === "rejected" ? (
          <div className="site-frame page-data-state">
            <PublicDataState
              kind={assetStateKind}
              title={assetStateKind === "timeout" ? "Katalog memerlukan waktu lebih lama." : "Katalog belum dapat dimuat."}
              message={assetStateKind === "timeout" ? "Permintaan dihentikan setelah melewati batas waktu aman. Coba muat ulang halaman." : "Layanan pusat tidak mengirim data yang valid. Tidak ada aset contoh yang digunakan sebagai pengganti."}
            />
          </div>
        ) : (
          <CatalogClient
            items={assets}
            categories={categories}
            publishers={publishers}
            provinces={provinces}
            nextCursor={assetsResult.value.next_cursor}
          />
        )}
      </main>
      <SiteFooter />
    </>
  );
}
