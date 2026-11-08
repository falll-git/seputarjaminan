import type { Metadata } from "next";
import CatalogClient from "../components/CatalogClient";
import styles from "./catalog.module.css";

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
  listPublicInstitutions,
  getPublicInstitution,
  listPublicAssets,
  publicDataStateKind,
} from "../lib/public-api";
import { parsePublicPageQuery } from "../lib/public-page-query";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Katalog aset | Seputar Jaminan by ruwang",
  description: "Telusuri katalog publik aset yang diterbitkan oleh BPRS melalui ruwang.",
};

type CatalogPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  let params: Record<string, string> = {};
  let queryError: unknown;
  try { params = parsePublicPageQuery(searchParams ? await searchParams : {}, "catalog"); }
  catch (error) { queryError = error; }
  const category = categoryCodeFromSlug(params.category ?? "");
  const institution = params.bprs;
  const query = params.q;
  const province = params.province;
  const cursor = params.cursor;
  const sort = params.sort === "terlama" ? "OLDEST" as const : "NEWEST" as const;

  const [assetsResult, taxonomyResult, institutionsResult] = await Promise.allSettled([
    queryError ? Promise.reject(queryError) : listPublicAssets({
      limit: 24,
      sort,
      ...(query ? { q: query } : {}),
      ...(category ? { category } : {}),
      ...(province ? { province } : {}),
      ...(institution ? { institution } : {}),
      ...(cursor ? { cursor } : {}),
    }),
    getPublicTaxonomy(),
    listPublicInstitutions({ limit: 20 }),
  ]);

  const assets = assetsResult.status === "fulfilled" ? assetsResult.value.items.map(toAsset) : [];
  const categories = taxonomyResult.status === "fulfilled" ? categoriesFromTaxonomy(taxonomyResult.value) : [];
  const publishers = institutionsResult.status === "fulfilled" ? institutionsResult.value.items.map(toBprsProfile) : [];
  // Resolve only the selected publisher if it is outside the first option page.
  if (institution && !publishers.some(p => p.slug === institution)) {
    const selected = await getPublicInstitution(institution).catch(() => null);
    if (selected) publishers.push(toBprsProfile(selected));
  }
  const provinces = Array.from(new Set([
    ...assets.map((asset) => asset.province),
    ...(province ? [province] : []),
  ].map((value) => value.trim()).filter(Boolean))).sort((left, right) => left.localeCompare(right, "id-ID"));
  const assetStateKind = assetsResult.status === "rejected" ? publicDataStateKind(assetsResult.reason) : "empty";

  return (
    <>
      <SiteHeader />
      <main className={styles.page}>
        <header className={`site-frame ${styles.heading}`}>
          <h1>Katalog aset</h1>
          <p>Cari agunan berdasarkan jenis aset, provinsi, atau BPRS.</p>
        </header>
        <CatalogClient
          items={assets}
          categories={categories}
          publishers={publishers}
          publisherCursor={institutionsResult.status === "fulfilled" ? institutionsResult.value.next_cursor : null}
          provinces={provinces}
          nextCursor={assetsResult.status === "fulfilled" ? assetsResult.value.next_cursor : null}
          errorKind={assetsResult.status === "rejected" ? assetStateKind : undefined}
          taxonomyUnavailable={taxonomyResult.status === "rejected"}
          publishersUnavailable={institutionsResult.status === "rejected"}
        />
      </main>
      <SiteFooter />
    </>
  );
}
