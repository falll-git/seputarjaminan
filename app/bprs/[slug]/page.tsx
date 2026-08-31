import { ArrowLeft, ArrowUpRight, Buildings, MapPin } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AssetCard from "@/app/components/AssetCard";
import BprsMark from "@/app/components/BprsMark";
import PublicDataState from "@/app/components/PublicDataState";
import SiteFooter from "@/app/components/SiteFooter";
import SiteHeader from "@/app/components/SiteHeader";
import { toAsset, toBprsProfile } from "@/app/data/catalog";
import {
  getPublicInstitution,
  isPublicNotFound,
  listPublicAssets,
  publicDataStateKind,
} from "@/app/lib/public-api";

export const dynamic = "force-dynamic";

type BprsProfilePageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: BprsProfilePageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const profile = await getPublicInstitution(slug);
    return {
      title: `${profile.public_name} | Seputar Jaminan by ruwang`,
      description: `${profile.public_name} menerbitkan ${profile.published_asset_count} aset aktif pada Seputar Jaminan.`,
    };
  } catch {
    return { title: "Profil BPRS | Seputar Jaminan by ruwang" };
  }
}

export default async function BprsProfilePage({ params }: BprsProfilePageProps) {
  const { slug } = await params;
  let profileResponse;
  try {
    profileResponse = await getPublicInstitution(slug);
  } catch (error) {
    if (isPublicNotFound(error)) notFound();
    return (
      <>
        <SiteHeader />
        <main className="bprs-profile-page site-frame page-data-state">
          <PublicDataState
            kind={publicDataStateKind(error)}
            title={publicDataStateKind(error) === "timeout" ? "Profil BPRS memerlukan waktu lebih lama." : "Profil BPRS belum dapat dimuat."}
            message={publicDataStateKind(error) === "timeout" ? "Permintaan dihentikan setelah melewati batas waktu aman. Coba muat ulang halaman." : "Silakan coba kembali beberapa saat lagi."}
          />
        </main>
        <SiteFooter />
      </>
    );
  }

  const profile = toBprsProfile(profileResponse);
  const assetsResult = await listPublicAssets({ institution: profile.slug, limit: 24, sort: "NEWEST" })
    .then((value) => ({ ok: true as const, value }))
    .catch((error: unknown) => ({ ok: false as const, error }));
  const profileAssets = assetsResult.ok ? assetsResult.value.items.map(toAsset) : [];

  return (
    <>
      <SiteHeader />
      <main className="bprs-profile-page">
        <header className="site-frame bprs-profile-masthead">
          <Link className="back-link" href="/bprs">
            <ArrowLeft aria-hidden="true" />
            <span>Kembali ke direktori</span>
          </Link>

          <div className="bprs-profile-identity">
            <div className="bprs-profile-mark-wrap">
              <BprsMark profile={profile} />
              <span className="bprs-profile-mark-label">Logo penerbit</span>
            </div>
            <div className="bprs-profile-heading">
              <p className="page-folio">Profil penerbit</p>
              <h1>{profile.name}</h1>
              <p className="bprs-profile-location"><MapPin aria-hidden="true" /> {profile.city}, {profile.province}</p>
              <p className="bprs-profile-description">{profile.description}</p>
            </div>
            <div className="bprs-profile-stat" aria-label={`${profile.publishedAssetCount} aset aktif`}>
              <strong>{String(profile.publishedAssetCount).padStart(2, "0")}</strong>
              <span>aset aktif</span>
            </div>
          </div>

          <p className="bprs-profile-source">Informasi publik ini dikelola oleh BPRS penerbit melalui ruwang.</p>
        </header>

        <section className="site-frame bprs-published-assets" aria-labelledby="published-assets-title">
          <div className="bprs-published-assets-head">
            <div>
              <p className="section-kicker">Katalog penerbit</p>
              <h2 id="published-assets-title">Aset dari {profile.name}</h2>
            </div>
            <Link className="editorial-link" href={`/katalog?bprs=${profile.slug}`}>
              <span>Buka di katalog</span>
              <ArrowUpRight aria-hidden="true" />
            </Link>
          </div>

          {!assetsResult.ok ? (
            <PublicDataState
              compact
              kind={publicDataStateKind(assetsResult.error)}
              title={publicDataStateKind(assetsResult.error) === "timeout" ? "Daftar aset memerlukan waktu lebih lama." : "Aset BPRS belum dapat dimuat."}
              message="Profil tetap tersedia, tetapi daftar aset belum berhasil dimuat. Coba kembali beberapa saat lagi."
            />
          ) : profileAssets.length ? (
            <div className={`bprs-profile-assets-grid bprs-profile-assets-grid--count-${Math.min(profileAssets.length, 3)}`}>
              {profileAssets.map((asset, index) => (
                <AssetCard key={asset.slug} asset={asset} priority={index < 2} showPublisher={false} size={profileAssets.length === 1 ? "wide" : "standard"} />
              ))}
            </div>
          ) : (
            <div className="bprs-profile-empty">
              <Buildings aria-hidden="true" />
              <div>
                <p className="section-kicker">Katalog belum tersedia</p>
                <h3>Belum ada aset aktif dari BPRS ini.</h3>
                <p>Profil penerbit tetap dapat dilihat. Aset akan muncul setelah diterbitkan melalui ruwang.</p>
                <Link href="/katalog">Jelajahi katalog lainnya <ArrowUpRight aria-hidden="true" /></Link>
              </div>
            </div>
          )}
        </section>

        <aside className="site-frame bprs-profile-notice" aria-label="Catatan informasi">
          <p>Harga, ketersediaan, dokumen, dan proses selanjutnya perlu dikonfirmasi langsung kepada BPRS penerbit pada setiap halaman aset.</p>
          <Link href="/cara-minat">Pelajari cara menyampaikan minat <ArrowUpRight aria-hidden="true" /></Link>
        </aside>
      </main>
      <SiteFooter />
    </>
  );
}
