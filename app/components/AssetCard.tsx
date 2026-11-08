"use client";

import { ArrowUpRight, Images, MapPin } from "@phosphor-icons/react";
import type { Asset, AssetSpec } from "../data/catalog";
import PublicMedia from "./PublicMedia";
import BprsMark from "./BprsMark";
import { StatusBadge } from "./ui";
import styles from "./AssetCard.module.css";
import Link from "next/link";
import { rememberCatalogPosition, safeCatalogReturn } from "../lib/catalog-navigation";

export type AssetCardProps = {
  asset: Asset;
  priority?: boolean;
  showPublisher?: boolean;
  size?: "standard" | "wide" | "tall";
  variant?: "catalog" | "display";
  /** Only public specifications already supplied by the caller. Never fetch per-card detail. */
  specs?: AssetSpec[];
  catalogReturn?: string;
};

/** One detail destination; the publisher link is a separate, non-overlapping target. */
export default function AssetCard({ asset, priority = false, showPublisher = true, variant = "catalog", specs, catalogReturn }: AssetCardProps) {
  const detailHref = `/aset/${asset.slug}${catalogReturn ? `?returnTo=${encodeURIComponent(safeCatalogReturn(catalogReturn))}` : ""}`;
  const remember = () => { if (catalogReturn) rememberCatalogPosition(catalogReturn); };
  const publicSpecs = (specs ?? asset.specs)?.filter(spec => spec.label.trim() && spec.value.trim()).slice(0, 2) ?? [];
  return (
    <article className={`${styles.card} ${variant === "display" ? styles.display : styles.catalog}`} data-asset-card={variant} data-asset-id={asset.id}>
      <Link className={styles.photo} href={detailHref} prefetch={false} onNavigate={remember} aria-label={`Buka detail ${asset.title}`}>
        <PublicMedia src={asset.cover.url} alt={asset.cover.altText} width={asset.cover.width} height={asset.cover.height} variant="card"
          sizes={variant === "display" ? "(max-width: 700px) 100vw, 50vw" : "(max-width: 700px) 100vw, 33vw"} preload={priority} />
        {asset.photoCount > 0 && <span className={styles.count}><Images aria-hidden="true" />{asset.photoCount} foto</span>}
      </Link>
      <div className={styles.body}>
        <div className={styles.meta}><span>{asset.categoryLabel}</span><StatusBadge>{asset.status}</StatusBadge></div>
        <h2><Link href={detailHref} prefetch={false} onNavigate={remember}>{asset.title}</Link></h2>
        <p className={styles.location}><MapPin aria-hidden="true" /><span>{[asset.city, asset.province].filter(Boolean).join(", ")}</span></p>
        {publicSpecs.length > 0 && <dl className={styles.specs}>{publicSpecs.map((spec, index) => <div key={`${spec.label}-${index}`}><dt>{spec.label}</dt><dd>{spec.value}</dd></div>)}</dl>}
        {showPublisher && (
          <a className={styles.publisher} href={`/bprs/${asset.publisher.slug}`}>
            <BprsMark profile={asset.publisher} compact />
            <span><small>Diterbitkan oleh</small><strong>{asset.publisher.name}</strong></span>
          </a>
        )}
        <div className={styles.foot}><span>{asset.id}</span><Link className="ui-text-link" href={detailHref} prefetch={false} onNavigate={remember} aria-label={`Lihat detail ${asset.title}`}>Lihat detail<ArrowUpRight aria-hidden="true" /></Link></div>
      </div>
    </article>
  );
}
