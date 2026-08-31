import type { Metadata } from "next";
import { ArrowRight, ArrowUpRight, Database, Eye, ShieldCheck, WhatsappLogo } from "@phosphor-icons/react/dist/ssr";
import AssetCard from "./components/AssetCard";
import BprsMarquee from "./components/BprsMarquee";
import EditorialRevealSection from "./components/EditorialRevealSection";
import HeroAssetCarousel from "./components/HeroAssetCarousel";
import PublicDataState from "./components/PublicDataState";
import SiteFooter from "./components/SiteFooter";
import SiteHeader from "./components/SiteHeader";
import { categoriesFromTaxonomy, toAsset, toBprsProfile } from "./data/catalog";
import { getPublicTaxonomy, listPublicAssets, listPublicInstitutions, publicDataStateKind } from "./lib/public-api";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Seputar Jaminan by ruwang",
  description: "Katalog publik aset jaminan yang diterbitkan langsung oleh BPRS melalui ruwang.",
};

export default async function Home() {
  const [assetResult, taxonomyResult, institutionResult] = await Promise.allSettled([
    listPublicAssets({ limit: 7, sort: "NEWEST" }),
    getPublicTaxonomy(),
    listPublicInstitutions({ limit: 16 }),
  ]);
  const assets = assetResult.status === "fulfilled" ? assetResult.value.items.map(toAsset) : [];
  const categories = taxonomyResult.status === "fulfilled" ? categoriesFromTaxonomy(taxonomyResult.value) : [];
  const institutions = institutionResult.status === "fulfilled" ? institutionResult.value.items.map(toBprsProfile) : [];
  const latestAssets = assets.slice(0, 3);
  const assetStateKind = assetResult.status === "rejected" ? publicDataStateKind(assetResult.reason) : "empty";
  const taxonomyStateKind = taxonomyResult.status === "rejected" ? publicDataStateKind(taxonomyResult.reason) : "empty";
  const institutionStateKind = institutionResult.status === "rejected" ? publicDataStateKind(institutionResult.reason) : "empty";

  return (
    <>
      <SiteHeader />
      <main>
        {assets.length > 0 ? (
          <HeroAssetCarousel slides={assets} />
        ) : (
          <section className="hero site-frame hero-with-data-state" aria-labelledby="hero-title">
            <div className="hero-copy">
              <p className="hero-kicker"><span>01</span> Katalog publik aset BPRS</p>
              <h1 id="hero-title">Temukan aset.<br />Kenali penerbitnya.</h1>
              <p className="hero-intro">Telusuri aset yang diterbitkan langsung oleh BPRS melalui ruwang, lengkap dengan lokasi dan jalur kontak penerbitnya.</p>
              <div className="hero-actions">
                <a className="button-primary" href="/katalog"><span>Jelajahi katalog</span><ArrowRight aria-hidden="true" /></a>
                <a className="text-link" href="/bprs"><span>Lihat BPRS penerbit</span><ArrowUpRight aria-hidden="true" /></a>
              </div>
              <p className="hero-assurance"><ShieldCheck aria-hidden="true" /><span>Tanpa akun</span><i aria-hidden="true" /><span>Informasi lanjutan melalui BPRS</span></p>
            </div>
            <div className="hero-showcase hero-state-showcase">
              <PublicDataState
                kind={assetStateKind}
                title={assetStateKind === "timeout" ? "Katalog memerlukan waktu lebih lama." : assetStateKind === "error" ? "Katalog belum dapat dimuat." : "Belum ada aset yang diterbitkan."}
                message={assetStateKind === "timeout" ? "Permintaan dihentikan setelah melewati batas waktu aman. Coba muat ulang halaman." : assetStateKind === "error" ? "Coba muat ulang halaman ini beberapa saat lagi." : "Aset akan tampil setelah BPRS menyelesaikan pemeriksaan dan menerbitkannya dari ruwang."}
              />
            </div>
          </section>
        )}

        {institutions.length > 0 ? (
          <BprsMarquee profiles={institutions} />
        ) : (
          <div className="site-frame section-data-state">
            <PublicDataState
              compact
              kind={institutionStateKind}
              title={institutionStateKind === "timeout" ? "Direktori BPRS memerlukan waktu lebih lama." : institutionStateKind === "error" ? "Daftar BPRS belum dapat dimuat." : "Belum ada BPRS penerbit aktif."}
              message="Direktori hanya menampilkan BPRS yang memiliki profil aktif dan aset terbit."
            />
          </div>
        )}

        <EditorialRevealSection className="category-index site-frame" labelledBy="category-heading">
          <header>
            <p>Indeks klasifikasi</p>
            <h2 id="category-heading">Mulai dari jenis aset.</h2>
            <p>Klasifikasi ini digunakan oleh Ruwang saat BPRS menyiapkan publikasi. Informasi legal dan ketersediaan tetap dikonfirmasi langsung kepada BPRS.</p>
          </header>
          {categories.length > 0 ? (
            <div className="category-index-list">
              {categories.map((category) => (
                <a href={`/katalog?category=${category.slug}`} key={category.slug}>
                  <span>{category.index}</span>
                  <div><strong>{category.label}</strong><small>{category.description}</small></div>
                  <em>Lihat aset</em>
                  <ArrowUpRight aria-hidden="true" />
                </a>
              ))}
            </div>
          ) : (
            <PublicDataState
              compact
              kind={taxonomyStateKind}
              title={taxonomyStateKind === "timeout" ? "Klasifikasi memerlukan waktu lebih lama." : "Klasifikasi belum dapat ditampilkan."}
              message="Katalog tidak memakai klasifikasi pengganti ketika layanan pusat belum tersedia."
            />
          )}
        </EditorialRevealSection>

        <EditorialRevealSection className="home-curation site-frame" labelledBy="curation-heading" delay={0.04}>
          <div className="home-section-head">
            <div><p>Pilihan dari katalog</p><h2 id="curation-heading">Terbaru dari penerbit.</h2></div>
            <a className="text-link" href="/katalog"><span>Buka katalog lengkap</span><ArrowRight aria-hidden="true" /></a>
          </div>
          {assets.length > 0 ? (
            <div className={`home-asset-grid home-asset-grid--count-${latestAssets.length}`}>
              {latestAssets.map((asset, index) => <AssetCard asset={asset} size={index === 0 ? "wide" : "standard"} priority={index === 0} key={asset.id} />)}
            </div>
          ) : (
            <PublicDataState
              compact
              kind={assetStateKind}
              title={assetStateKind === "timeout" ? "Aset terbaru memerlukan waktu lebih lama." : "Aset terbaru belum tersedia."}
              message="Tidak ada data contoh yang ditampilkan sebagai pengganti."
            />
          )}
        </EditorialRevealSection>

        <EditorialRevealSection className="home-process" labelledBy="home-process-title">
          <div className="site-frame home-process-head">
            <div>
              <p className="section-kicker">Cara kerja</p>
              <h2 id="home-process-title">Dari BPRS ke pengunjung, tanpa jalur yang rumit.</h2>
            </div>
            <div className="home-process-intro">
              <p>Seputar Jaminan menampilkan informasi publikasi dari sumbernya. Informasi lanjutan tetap dikonfirmasi oleh BPRS penerbit.</p>
              <a className="home-process-cta" href="/cara-minat"><span>Lihat cara menyampaikan minat</span><ArrowUpRight aria-hidden="true" /></a>
            </div>
          </div>
          <ol className="site-frame home-process-list">
            <li><span>01</span><Database aria-hidden="true" /><div><strong>BPRS menerbitkan melalui ruwang</strong><p>Admin BPRS menyiapkan dan memeriksa informasi publikasinya dari web internal.</p></div></li>
            <li><span>02</span><Eye aria-hidden="true" /><div><strong>Pengunjung melihat tanpa akun</strong><p>Aset dapat ditelusuri secara terbuka tanpa proses pendaftaran.</p></div></li>
            <li><span>03</span><WhatsappLogo aria-hidden="true" /><div><strong>Informasi lanjutan melalui WhatsApp</strong><p>Harga, dokumen, kondisi, dan ketersediaan dikonfirmasi langsung kepada BPRS.</p></div></li>
          </ol>
        </EditorialRevealSection>
      </main>
      <SiteFooter />
    </>
  );
}
