"use client";

import { ArrowUpRight, CalendarBlank, Eye, Images, MapPin } from "@phosphor-icons/react";
import { motion, useReducedMotion } from "motion/react";
import { useRef, useState } from "react";
import { formatPublicDate, type Asset } from "../data/catalog";
import { pressFeedback, PUBLIC_MOTION_DURATION, PUBLIC_MOTION_EASE } from "../lib/public-motion";
import AssetDossier from "./AssetDossier";
import PublicMedia from "./PublicMedia";

export default function AssetCard({ asset, priority = false, showPublisher = true, size = "standard" }: { asset: Asset; priority?: boolean; showPublisher?: boolean; size?: "standard" | "wide" | "tall" }) {
  const [open, setOpen] = useState(false);
  const quickViewTriggerRef = useRef<HTMLButtonElement>(null);
  const reducedMotion = useReducedMotion();
  return (
    <>
      <motion.article
        className={`asset-card asset-card-${size}`}
        layout={reducedMotion ? false : "position"}
        initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
        animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
        transition={{ duration: PUBLIC_MOTION_DURATION.standard, ease: PUBLIC_MOTION_EASE }}
      >
        <div className="asset-card-media">
          <a href={`/aset/${asset.slug}`} aria-label={`Buka detail ${asset.title}`}>
            <motion.div layoutId={`asset-image-${asset.id}`} className="asset-card-image">
              <PublicMedia
                src={asset.cover.url}
                alt={asset.cover.altText}
                width={asset.cover.width}
                height={asset.cover.height}
                sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 33vw"
                preload={priority}
              />
            </motion.div>
          </a>
          <div className="asset-card-media-meta">
            <span className="asset-reference-code">{asset.id}</span>
            <span className="asset-photo-count" aria-label={`${asset.photoCount} foto`}>
              <Images aria-hidden="true" />
              <span>{asset.photoCount} foto</span>
            </span>
          </div>
        </div>
        <div className="asset-card-folio">
          <span>{asset.categoryLabel} <i aria-hidden="true" /> {asset.subtype}</span>
          <span className="status-line"><i aria-hidden="true" />{asset.status}</span>
        </div>
        <h2><a href={`/aset/${asset.slug}`}>{asset.title}</a></h2>
        <div className="asset-card-meta">
          <span className="asset-location"><MapPin aria-hidden="true" />{asset.city}, {asset.province}</span>
          {showPublisher && (
            <a className="asset-publisher-link" href={`/bprs/${asset.publisher.slug}`}>
              <span><small>Diterbitkan oleh</small>{asset.publisher.name}</span>
              <ArrowUpRight aria-hidden="true" />
            </a>
          )}
        </div>
        <div className="asset-card-footer">
          <time dateTime={asset.updatedAt}><CalendarBlank aria-hidden="true" />Diperbarui {formatPublicDate(asset.updatedAt)}</time>
          <motion.button ref={quickViewTriggerRef} className="asset-quick-view" type="button" onClick={() => setOpen(true)} {...pressFeedback(reducedMotion)}>
            <Eye aria-hidden="true" />
            <span>Lihat ringkas</span>
          </motion.button>
        </div>
      </motion.article>
      <AssetDossier asset={asset} open={open} onOpenChange={setOpen} returnFocusRef={quickViewTriggerRef} />
    </>
  );
}
