import { ArrowLeft, ArrowUpRight, MapPin } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AssetCard from "@/app/components/AssetCard";
import BprsMark from "@/app/components/BprsMark";
import PublicDataState from "@/app/components/PublicDataState";
import SiteFooter from "@/app/components/SiteFooter";
import SiteHeader from "@/app/components/SiteHeader";
import { TextLink } from "@/app/components/ui";
import styles from "../bprs.module.css";
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
      description: profile.short_description,
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
          <TextLink href="/bprs">Kembali ke daftar BPRS</TextLink>
          <PublicDataState
            headingLevel={1}
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
      <main className={styles.page}>
        <div className={`site-frame ${styles.back}`}>
          <Link className="ui-text-link" href="/bprs">
            <ArrowLeft aria-hidden="true" />
            <span>Kembali ke direktori</span>
          </Link>
          <TextLink href="/katalog">Jelajahi katalog <ArrowUpRight aria-hidden="true" /></TextLink>
        </div>
        <header className={`site-frame ${styles.profileHeader}`}>
            <div className={styles.profileLogo}>
              <BprsMark profile={profile} />
            </div>
            <div className={styles.profileHeading}>
              <p className={styles.eyebrow}>BPRS penerbit</p>
              <h1>{profile.name}</h1>
              <p className={styles.location}><MapPin aria-hidden="true" /> {profile.city}, {profile.province}</p>
              <p className={styles.description}>{profile.description}</p>
              {Number.isSafeInteger(profile.publishedAssetCount) && profile.publishedAssetCount >= 0 && <p className={styles.profileCount} aria-label={`${profile.publishedAssetCount} aset tersedia`}><strong>{profile.publishedAssetCount.toLocaleString("id-ID")}</strong> aset tersedia di katalog</p>}
            </div>
        </header>

        <section className={`site-frame ${styles.assets}`} aria-labelledby="published-assets-title">
          <div className={styles.assetsHead}>
              <h2 id="published-assets-title">Aset dari BPRS ini</h2>
            <Link className="ui-text-link" href={`/katalog?bprs=${profile.slug}`}>
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
            <div className={styles.assetsGrid} data-bprs-assets>
              {profileAssets.map((asset, index) => (
                <AssetCard key={asset.slug} asset={asset} priority={index < 2} />
              ))}
            </div>
          ) : (
            <PublicDataState kind="empty" scene="profile" title="Belum ada aset tersedia dari BPRS ini." message="Anda dapat melihat aset dari BPRS lain atau kembali nanti.">
                <TextLink href="/katalog">Jelajahi katalog lainnya <ArrowUpRight aria-hidden="true" /></TextLink>
            </PublicDataState>
          )}
          {assetsResult.ok && assetsResult.value.next_cursor && <div className={styles.pagination}>
            <p>Menampilkan {profileAssets.length} aset terbaru. Masih ada aset lainnya.</p>
            <Link className="ui-button ui-button-secondary" href={`/katalog?${new URLSearchParams({ bprs: profile.slug, cursor: assetsResult.value.next_cursor })}`}>Lihat aset berikutnya <ArrowUpRight aria-hidden="true" /></Link>
          </div>}
        </section>

        <aside className={`site-frame ${styles.help}`} aria-label="Bantuan menghubungi BPRS">
          <p>Pilih aset untuk membaca detail dan menghubungi kontak yang ditentukan BPRS.</p>
          <TextLink href="/cara-minat">Cara menghubungi <ArrowUpRight aria-hidden="true" /></TextLink>
        </aside>
      </main>
      <SiteFooter compact />
    </>
  );
}
