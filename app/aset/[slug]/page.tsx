import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Buildings,
  CalendarBlank,
  MapPin,
  SealCheck,
  WhatsappLogo,
} from "@phosphor-icons/react/dist/ssr";
import AssetDetailGallery from "../../components/AssetDetailGallery";
import PublicDataState from "../../components/PublicDataState";
import SiteFooter from "../../components/SiteFooter";
import SiteHeader from "../../components/SiteHeader";
import BprsMark from "../../components/BprsMark";
import PublicMedia from "../../components/PublicMedia";
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

export default async function AssetPage({ params }: AssetPageProps) {
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
          <PublicDataState
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
      <main className="asset-detail-page">
        <div className="site-frame asset-detail-back-row">
          <a className="asset-detail-back" href="/katalog"><ArrowLeft aria-hidden="true" /> Kembali ke katalog</a>
          <span>Indeks aset · {asset.id}</span>
        </div>

        <article className="site-frame asset-detail-editorial">
          <AssetDetailGallery assetId={asset.id} assetTitle={asset.title} images={asset.gallery} />

          <aside className="asset-detail-information" aria-labelledby="asset-title">
            <div className="asset-detail-heading">
              <p className="asset-detail-kicker">{asset.categoryLabel} · {asset.subtype}</p>
              <p className="asset-detail-status"><span aria-hidden="true" /> {asset.status}</p>
              <h1 id="asset-title">{asset.title}</h1>
              <p className="asset-detail-location"><MapPin aria-hidden="true" /> {asset.city}, {asset.province}</p>
            </div>

            <p className="asset-detail-lead">{asset.description}</p>

            <section className="asset-contact-panel" aria-labelledby="asset-contact-heading">
              <div>
                <p>Informasi langsung dari BPRS</p>
                <h2 id="asset-contact-heading">Tanyakan ketersediaan dan proses berikutnya.</h2>
                <span>Tujuan pesan telah dipilih untuk publikasi ini oleh {asset.publisher.name}.</span>
              </div>
              <a className="asset-whatsapp-cta" href={asset.whatsappUrl} target="_blank" rel="noreferrer">
                <WhatsappLogo aria-hidden="true" />
                <span>Tanyakan aset ini</span>
                <ArrowUpRight aria-hidden="true" />
              </a>
            </section>

            <a className="asset-mobile-whatsapp" href={asset.whatsappUrl} target="_blank" rel="noreferrer">
              <WhatsappLogo aria-hidden="true" />
              <span>Tanyakan aset ini</span>
              <ArrowUpRight aria-hidden="true" />
            </a>

            {asset.specs.length > 0 && (
              <section className="asset-specification-section" aria-labelledby="asset-specification-heading">
                <div className="asset-detail-section-heading">
                  <h2 id="asset-specification-heading">Informasi utama</h2>
                  <span>{asset.specs.length} spesifikasi</span>
                </div>
                <dl className="asset-detail-specs">
                  {asset.specs.map((spec, index) => (
                    <div key={spec.label}>
                      <dt>{String(index + 1).padStart(2, "0")} · {spec.label}</dt>
                      <dd>{spec.value}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}

            <section className="asset-publisher" aria-labelledby="publisher-heading">
              <div className="asset-publisher-mark">
                <BprsMark profile={asset.publisher} compact />
              </div>
              <div className="asset-publisher-copy">
                <p id="publisher-heading">Dipublikasikan oleh</p>
                <h2>{asset.publisher.name}</h2>
                <span><Buildings aria-hidden="true" /> {publisher ? `${publisher.city}, ${publisher.province}` : "Profil BPRS penerbit"}</span>
              </div>
              <a href={`/bprs/${asset.publisher.slug}`} aria-label={`Buka profil ${asset.publisher.name}`}><ArrowUpRight aria-hidden="true" /></a>
            </section>

            <section className="asset-publication-note" aria-labelledby="asset-publication-note-heading">
              <div className="asset-detail-update">
                <CalendarBlank aria-hidden="true" />
                <span>Diperbarui {formatPublicDate(asset.updatedAt)}</span>
                <i aria-hidden="true" />
                <span>Referensi {asset.id}</span>
              </div>

              <div className="asset-detail-verification">
                <SealCheck aria-hidden="true" />
                <p id="asset-publication-note-heading"><strong>Konfirmasi sebelum melanjutkan.</strong> Harga, ketersediaan, dokumen, dan proses berikutnya diberikan langsung oleh BPRS penerbit melalui WhatsApp.</p>
              </div>
            </section>
          </aside>
        </article>

        {relatedAssets.length > 0 && (
          <section className="site-frame related-assets" aria-labelledby="related-assets-title">
            <div className="related-assets-heading">
              <div>
                <p>Indeks lanjutan</p>
                <h2 id="related-assets-title">Aset terkait</h2>
              </div>
              <a href={`/katalog?category=${asset.category}`}>Lihat kategori {asset.categoryLabel} <ArrowRight aria-hidden="true" /></a>
            </div>
            <div className="related-assets-grid">
              {relatedAssets.map((related, index) => (
                <article className="related-asset" key={related.id}>
                  <a className="related-asset-image" href={`/aset/${related.slug}`}>
                    <PublicMedia
                      src={related.cover.url}
                      alt={related.cover.altText}
                      width={related.cover.width}
                      height={related.cover.height}
                      sizes="(max-width: 760px) 100vw, 33vw"
                    />
                    <span className="related-asset-index">{String(index + 1).padStart(2, "0")}</span>
                  </a>
                  <div className="related-asset-copy">
                    <p>{related.id} · {related.city}, {related.province}</p>
                    <h3><a href={`/aset/${related.slug}`}>{related.title}</a></h3>
                    <span>{related.publisher.name}</span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </main>
      <SiteFooter />
    </>
  );
}
