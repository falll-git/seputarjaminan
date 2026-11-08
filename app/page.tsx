import type { Metadata } from "next";
import { ArrowRight, ArrowUpRight, Car, Factory, House, MapTrifold, MagnifyingGlass, BookOpenText, WhatsappLogo } from "@phosphor-icons/react/dist/ssr";
import AssetShowcaseCard from "./components/AssetShowcaseCard";
import { SectionHeading, TextLink } from "./components/ui";
import BprsMarquee from "./components/BprsMarquee";
import HeroAssetCarousel from "./components/HeroAssetCarousel";
import HomeFaq from "./components/HomeFaq";
import PublicDataState from "./components/PublicDataState";
import SiteFooter from "./components/SiteFooter";
import SiteHeader from "./components/SiteHeader";
import { categoriesFromTaxonomy, toAsset, toBprsProfile } from "./data/catalog";
import { getPublicShowcase, getPublicTaxonomy, listPublicAssets, listPublicInstitutions, publicDataStateKind } from "./lib/public-api";
import styles from "./home.module.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Seputar Jaminan by ruwang",
  description: "Lihat agunan dari BPRS, baca detail aset, dan hubungi BPRS melalui WhatsApp.",
};
const categoryIcons = { TANAH: MapTrifold, BANGUNAN: House, MESIN_PERALATAN: Factory, KENDARAAN: Car };

export default async function Home() {
  const [assetResult, taxonomyResult, institutionResult, showcaseResult] = await Promise.allSettled([
    listPublicAssets({ limit: 3, sort: "NEWEST" }),
    getPublicTaxonomy(),
    listPublicInstitutions({ limit: 16 }),
    getPublicShowcase(),
  ]);
  const assets = assetResult.status === "fulfilled" ? assetResult.value.items.map(toAsset) : [];
  const categories = taxonomyResult.status === "fulfilled" ? categoriesFromTaxonomy(taxonomyResult.value) : [];
  const institutions = institutionResult.status === "fulfilled" ? institutionResult.value.items.map(toBprsProfile) : [];
  const latestAssets = assets.slice(0, 3);
  const showcase = showcaseResult.status === "fulfilled" ? showcaseResult.value.items.map(toAsset) : [];
  const showcaseState = showcaseResult.status === "rejected" ? publicDataStateKind(showcaseResult.reason) : "empty";
  const assetStateKind = assetResult.status === "rejected" ? publicDataStateKind(assetResult.reason) : "empty";
  const taxonomyStateKind = taxonomyResult.status === "rejected" ? publicDataStateKind(taxonomyResult.reason) : "empty";
  const institutionStateKind = institutionResult.status === "rejected" ? publicDataStateKind(institutionResult.reason) : "empty";

  return (
    <>
      <SiteHeader />
      <main className={styles.home}>
        <section className={`site-frame ${styles.hero}`} aria-labelledby="hero-title" data-home-section="hero">
          <div className={styles.copy}>
            <h1 id="hero-title">Jelajahi aset dari BPRS</h1>
            <p className={styles.intro}>Lihat agunan dari BPRS, kenali detailnya, lalu hubungi BPRS melalui WhatsApp.</p>
          </div>
          <div className={styles.categories} data-home-section="categories">
            <h2>Pilih jenis aset</h2>
            {categories.length > 0 ? (
              <nav aria-label="Kategori aset" className={styles.categoryGrid}>
                {categories.map((category) => {
                  const Icon = categoryIcons[category.code];
                  return <a href={`/katalog?category=${category.slug}`} key={category.slug}><span className={styles.categoryIcon}><Icon weight="duotone" aria-hidden="true" /></span><span>{category.label}</span></a>;
                })}
              </nav>
            ) : <PublicDataState compact kind={taxonomyStateKind} title="Kategori belum dapat ditampilkan." message="Anda tetap dapat mencari aset melalui kolom pencarian." />}
          </div>
          <div className={styles.visual}>
            {showcase.length > 0 ? <HeroAssetCarousel slides={showcase} /> : (
              <div className={styles.emptyHero}>
                <PublicDataState kind={showcaseState}
                  title={showcaseState === "empty" ? "Belum ada aset yang diterbitkan." : "Etalase belum dapat dimuat."}
                  message={showcaseState === "empty" ? "Silakan kembali lagi untuk melihat aset yang tersedia." : "Coba muat ulang untuk melihat aset dari BPRS."} />
              </div>
            )}
          </div>
        </section>

        {institutions.length > 0 ? <BprsMarquee profiles={institutions} /> : (
          <section className={`site-frame ${styles.section}`} aria-label="BPRS penerbit" data-home-section="bprs">
            <PublicDataState compact kind={institutionStateKind} scene="directory"
              title={institutionStateKind === "empty" ? "Belum ada BPRS dengan aset yang tersedia." : institutionStateKind === "timeout" ? "Direktori BPRS memerlukan waktu lebih lama." : "Daftar BPRS belum dapat dimuat."}
              message={institutionStateKind === "empty" ? "BPRS dengan aset yang tersedia akan tampil di sini." : "Coba muat ulang untuk melihat daftar BPRS."} />
          </section>
        )}

        <section className={`site-frame ${styles.section}`} aria-labelledby="curation-heading" data-home-section="latest">
          <div className={styles.sectionHead}>
            <SectionHeading eyebrow="Dari katalog" id="curation-heading">Aset terbaru</SectionHeading>
            <TextLink href="/katalog">Lihat semua aset<ArrowRight aria-hidden="true" /></TextLink>
          </div>
          {assets.length > 0 ? (
            <div className={styles.assets} data-count={latestAssets.length}>
              {latestAssets.map((asset) => <AssetShowcaseCard asset={asset} key={asset.id} />)}
            </div>
          ) : <PublicDataState compact kind={assetStateKind} title={assetStateKind === "empty" ? "Aset terbaru belum tersedia." : "Aset terbaru belum dapat dimuat."} message={assetStateKind === "empty" ? "Kembali lagi untuk melihat publikasi terbaru dari BPRS." : "Silakan coba muat ulang halaman."} />}
        </section>

        <section className={`site-frame ${styles.guide}`} aria-labelledby="home-process-title" data-home-section="guide">
          <div className={styles.sectionHead}>
            <SectionHeading eyebrow="Mulai di sini" id="home-process-title">Tiga langkah sederhana</SectionHeading>
            <TextLink href="/cara-minat">Cara menghubungi<ArrowUpRight aria-hidden="true" /></TextLink>
          </div>
          <ol className={styles.steps}>
            <li><span>01</span><MagnifyingGlass aria-hidden="true" /><h3>Cari aset</h3><p>Gunakan pencarian atau pilih jenis aset.</p></li>
            <li><span>02</span><BookOpenText aria-hidden="true" /><h3>Baca detail</h3><p>Lihat foto, lokasi, dan informasi aset.</p></li>
            <li><span>03</span><WhatsappLogo aria-hidden="true" /><h3>Hubungi BPRS</h3><p>Buka WhatsApp dari halaman detail aset.</p></li>
          </ol>
        </section>
        <HomeFaq />
      </main>
      <SiteFooter compact />
    </>
  );
}
