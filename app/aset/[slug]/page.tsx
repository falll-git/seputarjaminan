import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  Buildings,
  MapPin,
} from "@phosphor-icons/react/dist/ssr";
import AssetDetailGallery from "../../components/AssetDetailGallery";
import CatalogReturnLink from "../../components/CatalogReturnLink";
import PublicDataState from "../../components/PublicDataState";
import SiteFooter from "../../components/SiteFooter";
import SiteHeader from "../../components/SiteHeader";
import BprsMark from "../../components/BprsMark";
import AssetCard from "../../components/AssetCard";
import AssetContact from "../../components/AssetContact";
import { SectionHeading, StatusBadge, TextLink } from "../../components/ui";
import styles from "./detail.module.css";
import type { AssetDetail } from "../../data/catalog";
import { formatPublicDate, toAsset, toAssetDetail, toBprsProfile } from "../../data/catalog";
import {
  getPublicAsset,
  getPublicInstitution,
  isPublicNotFound,
  listPublicAssets,
  publicDataStateKind,
  referenceCodeFromSlug,
} from "../../lib/public-api";

export const dynamic = "force-dynamic";

type AssetPageProps = {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ returnTo?: string | string[] }>;
};

export async function generateMetadata({ params }: AssetPageProps): Promise<Metadata> {
  const { slug } = await params;
  const referenceCode = referenceCodeFromSlug(slug);
  if (!referenceCode) return { title: "Aset tidak ditemukan | Seputar Jaminan by ruwang" };
  try {
    const asset = toAssetDetail(await getPublicAsset(referenceCode));
    return {
      title: `${asset.title} | Seputar Jaminan by ruwang`,
      description: `${asset.description} Informasi dipublikasikan oleh ${asset.publisher.name}.`,
      openGraph: {
        title: asset.title,
        description: asset.description,
        images: [{ url: asset.cover.url, alt: asset.cover.altText }],
      },
    };
  } catch {
    return { title: "Detail aset | Seputar Jaminan by ruwang" };
  }
}

export default async function AssetPage({ params, searchParams }: AssetPageProps) {
  const returnValue = (await searchParams)?.returnTo;
  const returnTo = Array.isArray(returnValue) ? returnValue[0] : returnValue;
  const { slug } = await params;
  const referenceCode = referenceCodeFromSlug(slug);
  if (!referenceCode) notFound();

  let asset: AssetDetail;
  try {
    asset = toAssetDetail(await getPublicAsset(referenceCode));
  } catch (error) {
    if (isPublicNotFound(error)) notFound();
    return (
      <>
        <SiteHeader />
        <main className="asset-detail-page site-frame page-data-state">
          <CatalogReturnLink returnTo={returnTo} />
          <PublicDataState
            headingLevel={1}
            kind={publicDataStateKind(error)}
            title={publicDataStateKind(error) === "timeout" ? "Detail aset memerlukan waktu lebih lama." : "Detail aset belum dapat dimuat."}
            message={publicDataStateKind(error) === "timeout" ? "Permintaan dihentikan setelah melewati batas waktu aman. Coba muat ulang halaman." : "Silakan coba kembali beberapa saat lagi."}
          />
        </main>
        <SiteFooter />
      </>
    );
  }

  const [publisherResult, relatedResult] = await Promise.allSettled([
    getPublicInstitution(asset.publisher.slug),
    listPublicAssets({ category: asset.categoryCode, province: asset.province, limit: 4, sort: "NEWEST" }),
  ]);
  const publisher = publisherResult.status === "fulfilled" ? toBprsProfile(publisherResult.value) : null;
  const relatedAssets = relatedResult.status === "fulfilled"
    ? relatedResult.value.items.map(toAsset).filter((candidate) => candidate.id !== asset.id).slice(0, 3)
    : [];

  return (
    <>
      <SiteHeader />
      <main className={styles.page}>
        <div className={`site-frame ${styles.back}`}>
          <CatalogReturnLink returnTo={returnTo} />
          <span>{asset.id}</span>
        </div>

        <article className={`site-frame ${styles.editorial}`}>
            <header className={styles.heading}>
              <div className={styles.eyebrow}><span>{asset.categoryLabel}{asset.subtype !== asset.categoryLabel && ` · ${asset.subtype}`}</span><StatusBadge>{asset.status}</StatusBadge></div>
              <h1 id="asset-title">{asset.title}</h1>
              <p className={styles.location}><MapPin aria-hidden="true" /> {asset.city}, {asset.province}</p>
              <a className={styles.issuer} href={`/bprs/${asset.publisher.slug}`}>Dari {asset.publisher.name}</a>
            </header>
          <div className={styles.gallery}><AssetDetailGallery assetId={asset.id} assetTitle={asset.title} images={asset.gallery} /></div>
          <div className={styles.information}>
            <section className={styles.contact} aria-labelledby="publisher-heading">
              <div className={styles.publisher}>
                <div className={styles.mark}><BprsMark profile={asset.publisher} compact /></div>
                <div><p>BPRS penerbit</p><h2 id="publisher-heading">{asset.publisher.name}</h2>
                  {publisher && <p className={styles.office}><Buildings aria-hidden="true" />{publisher.city}, {publisher.province}</p>}
                </div>
              </div>
              <TextLink href={`/bprs/${asset.publisher.slug}`}>Lihat profil BPRS <ArrowUpRight aria-hidden="true" /></TextLink>
              <p className={styles.contactNote}>Untuk informasi lanjutan, hubungi BPRS melalui WhatsApp.</p>
              <AssetContact configuredUrl={asset.whatsappUrl} title={asset.title} reference={asset.id} publisherName={asset.publisher.name} />
            </section>

            {asset.specs.length > 0 && (
              <section className={styles.section} aria-labelledby="asset-specification-heading">
                <h2 id="asset-specification-heading">Spesifikasi</h2>
                <dl className={styles.specs}>
                  {asset.specs.map((spec) => (
                    <div key={spec.label}>
                      <dt>{spec.label}</dt>
                      <dd>{spec.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}

            <section className={styles.section} aria-labelledby="asset-description-heading">
              <h2 id="asset-description-heading">Tentang aset</h2>
              <p className={styles.description}>{asset.description}</p>
            </section>
            <div className={styles.note}>
              <p>Diperbarui {formatPublicDate(asset.updatedAt)} · {asset.id}</p>
              <p>Konfirmasikan ketersediaan, dokumen, dan proses berikutnya langsung kepada BPRS penerbit.</p>
            </div>
          </div>
        </article>

        {relatedAssets.length > 0 && (
          <section className={`site-frame ${styles.related}`} aria-labelledby="related-assets-title">
            <div className={styles.relatedHeading}>
              <SectionHeading id="related-assets-title">Aset terkait</SectionHeading>
              <TextLink href={`/katalog?category=${asset.category}`}>Lihat kategori {asset.categoryLabel} <ArrowRight aria-hidden="true" /></TextLink>
            </div>
            <div className={styles.relatedGrid}>
              {relatedAssets.map((related) => <AssetCard key={related.id} asset={related} />)}
            </div>
          </section>
        )}
      </main>
      <SiteFooter compact />
      <AssetContact mobile configuredUrl={asset.whatsappUrl} title={asset.title} reference={asset.id} publisherName={asset.publisher.name} />
    </>
  );
}
