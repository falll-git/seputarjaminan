"use client";

import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  MapPin,
  ShareNetwork,
  WhatsappLogo,
  X,
} from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useState, type RefObject } from "react";
import type { PublicAssetDetail } from "@seputarjaminan/contracts";
import type { Asset, AssetDetail } from "../data/catalog";
import { toAssetDetail } from "../data/catalog";
import { pressFeedback, PUBLIC_MOTION_DURATION, PUBLIC_MOTION_EASE } from "../lib/public-motion";
import BprsMark from "./BprsMark";
import MediaLightbox from "./MediaLightbox";
import PublicMedia from "./PublicMedia";

type LoadState = "idle" | "loading" | "ready" | "error";

export default function AssetDossier({
  asset,
  open,
  onOpenChange,
  returnFocusRef,
}: {
  asset: Asset;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  returnFocusRef: RefObject<HTMLButtonElement | null>;
}) {
  const [activeImage, setActiveImage] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [shareState, setShareState] = useState("Bagikan");
  const [loadError, setLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [detail, setDetail] = useState<AssetDetail | null>(null);
  const reducedMotion = useReducedMotion();
  const gallery = useMemo(() => detail?.gallery ?? [asset.cover], [asset.cover, detail]);
  const activeMedia = gallery[activeImage] ?? gallery[0];
  const prioritySpecs = detail?.specs.slice(0, 5) ?? [];

  const loadDetail = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch(`/api/public/assets/${encodeURIComponent(asset.id)}`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal,
      });
      if (!response.ok) throw new Error("detail_unavailable");
      const payload = await response.json() as PublicAssetDetail;
      setDetail(toAssetDetail(payload));
      setActiveImage(0);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setDetail(null);
      setLoadError(true);
    }
  }, [asset.id]);

  useEffect(() => {
    if (!open || detail || loadError) return;
    const controller = new AbortController();
    const run = async () => loadDetail(controller.signal);
    void run();
    return () => controller.abort();
  }, [detail, loadAttempt, loadDetail, loadError, open]);

  const loadState: LoadState = detail ? "ready" : loadError ? "error" : open ? "loading" : "idle";

  function retryDetail() {
    setLoadError(false);
    setLoadAttempt((attempt) => attempt + 1);
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setActiveImage(0);
      setLightboxOpen(false);
      setShareState("Bagikan");
    }
    onOpenChange(nextOpen);
  }

  function move(direction: number) {
    setActiveImage((current) => (current + direction + gallery.length) % gallery.length);
  }

  function openGallery(index: number) {
    setActiveImage(index);
    setLightboxOpen(true);
  }

  async function shareAsset() {
    const url = `${window.location.origin}/aset/${asset.slug}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: asset.title, text: `${asset.id} · ${asset.title}`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShareState("Tautan tersalin");
      window.setTimeout(() => setShareState("Bagikan"), 1_800);
    } catch {
      setShareState("Bagikan");
    }
  }

  return (
    <>
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="dossier-overlay"
                initial={reducedMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: PUBLIC_MOTION_DURATION.fast }}
              />
            </Dialog.Overlay>
            <Dialog.Content
              asChild
              forceMount
              aria-describedby={`dossier-description-${asset.id}`}
              onCloseAutoFocus={(event) => {
                event.preventDefault();
                returnFocusRef.current?.focus();
              }}
            >
              <motion.div
                className="dossier"
                initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 28, scale: 0.985 }}
                animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
                exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.995 }}
                transition={{ duration: PUBLIC_MOTION_DURATION.slow, ease: PUBLIC_MOTION_EASE }}
              >
                <div className={`dossier-gallery ${gallery.length > 1 ? "has-filmstrip" : "is-single"}`}>
                  <motion.button className="dossier-main-image" type="button" onClick={() => openGallery(activeImage)} aria-label="Buka galeri layar penuh" {...pressFeedback(reducedMotion)}>
                    <motion.div layoutId={`asset-image-${asset.id}`} className="dossier-image-motion">
                      <AnimatePresence mode="wait" initial={false}>
                        {activeMedia && (
                          <motion.div
                            className="dossier-image-frame"
                            key={`${activeMedia.url}-${activeImage}`}
                            initial={reducedMotion ? false : { opacity: 0, x: 12 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={reducedMotion ? undefined : { opacity: 0, x: -12 }}
                            transition={{ duration: PUBLIC_MOTION_DURATION.standard, ease: PUBLIC_MOTION_EASE }}
                          >
                            <PublicMedia
                              src={activeMedia.url}
                              alt={activeMedia.altText}
                              width={activeMedia.width}
                              height={activeMedia.height}
                              sizes="(max-width: 920px) 100vw, 62vw"
                              preload
                            />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  </motion.button>
                  <div className="dossier-photo-folio">
                    <span>{asset.id}</span>
                    <span>{String(activeImage + 1).padStart(2, "0")} / {String(gallery.length).padStart(2, "0")}</span>
                  </div>
                  {gallery.length > 1 && (
                    <div className="dossier-photo-arrows">
                      <motion.button type="button" onClick={() => move(-1)} aria-label="Foto sebelumnya" {...pressFeedback(reducedMotion)}><ArrowLeft aria-hidden="true" /></motion.button>
                      <motion.button type="button" onClick={() => move(1)} aria-label="Foto berikutnya" {...pressFeedback(reducedMotion)}><ArrowRight aria-hidden="true" /></motion.button>
                    </div>
                  )}
                  {gallery.length > 1 && (
                    <div className="dossier-filmstrip" aria-label="Pilih foto">
                      {gallery.map((media, index) => (
                        <motion.button
                          className={index === activeImage ? "is-active" : ""}
                          type="button"
                          key={`${media.url}-${index}`}
                          onClick={() => setActiveImage(index)}
                          aria-label={`Tampilkan foto ${index + 1}`}
                          aria-pressed={index === activeImage}
                          {...pressFeedback(reducedMotion)}
                        >
                          <PublicMedia
                            src={media.url}
                            alt={media.altText}
                            width={media.width}
                            height={media.height}
                            sizes="100px"
                            decorative
                            compact
                          />
                          <span className="dossier-filmstrip-index">{String(index + 1).padStart(2, "0")}</span>
                        </motion.button>
                      ))}
                    </div>
                  )}
                  <p className="dossier-visual-note">Foto publikasi dari BPRS penerbit</p>
                </div>

                <div className="dossier-information">
                  <div className="dossier-toolbar">
                    <div className="dossier-toolbar-context" aria-hidden="true">
                      <span>Ringkasan aset</span>
                      <strong>{asset.id}</strong>
                    </div>
                    <div className="dossier-toolbar-actions">
                      <motion.button type="button" onClick={shareAsset} aria-label="Bagikan aset" {...pressFeedback(reducedMotion)}><ShareNetwork aria-hidden="true" /><span>{shareState}</span></motion.button>
                      <Dialog.Close asChild><motion.button type="button" aria-label="Tutup detail aset" {...pressFeedback(reducedMotion)}><X aria-hidden="true" /></motion.button></Dialog.Close>
                    </div>
                  </div>

                  <div className="dossier-scroll">
                    <div className="dossier-copy">
                      <div className="dossier-meta-line">
                        <span>{asset.categoryLabel} · {asset.subtype}</span>
                        <span className="status-line"><i aria-hidden="true" />{asset.status}</span>
                      </div>
                      <Dialog.Title className="dossier-title">{asset.title}</Dialog.Title>
                      <p className="dossier-location"><MapPin aria-hidden="true" />{asset.city}, {asset.province}</p>

                      {loadState === "loading" && (
                        <Dialog.Description id={`dossier-description-${asset.id}`} className="dossier-description" aria-live="polite">
                          Memuat informasi aset terbaru…
                        </Dialog.Description>
                      )}

                      {loadState === "error" && (
                        <div className="dossier-load-error" id={`dossier-description-${asset.id}`} role="status">
                          <p>Informasi ringkas belum dapat dimuat.</p>
                          <motion.button type="button" onClick={retryDetail} {...pressFeedback(reducedMotion)}>Coba lagi</motion.button>
                        </div>
                      )}

                      {detail && (
                        <>
                          <Dialog.Description id={`dossier-description-${asset.id}`} className="dossier-description">{detail.description}</Dialog.Description>
                          {prioritySpecs.length > 0 && (
                            <div className="dossier-specs-heading">
                              <span>Informasi utama</span>
                              <small>Maksimal 5 spesifikasi</small>
                            </div>
                          )}
                          {prioritySpecs.length > 0 && (
                          <dl className="dossier-specs">
                              {prioritySpecs.map((spec) => <div key={spec.label}><dt>{spec.label}</dt><dd>{spec.value}</dd></div>)}
                          </dl>
                          )}
                        </>
                      )}

                      <section className="publisher-signature" aria-label="BPRS penerbit">
                        <BprsMark profile={asset.publisher} compact />
                        <div><small>Dipublikasikan oleh</small><a href={`/bprs/${asset.publisher.slug}`}>{asset.publisher.name}</a><span>{asset.city}, {asset.province}</span></div>
                        <ArrowUpRight aria-hidden="true" />
                      </section>

                      <div className="dossier-contact">
                        <p><strong>Tertarik pada aset ini?</strong> Harga, legalitas, kondisi, dan ketersediaan terbaru dikonfirmasi langsung oleh BPRS penerbit.</p>
                        {detail ? (
                          <motion.a className="dossier-whatsapp dossier-whatsapp-desktop" href={detail.whatsappUrl} target="_blank" rel="noreferrer" {...pressFeedback(reducedMotion)}>
                            <WhatsappLogo aria-hidden="true" /><span>Tanyakan melalui WhatsApp</span><ArrowUpRight aria-hidden="true" />
                          </motion.a>
                        ) : (
                          <span className="dossier-whatsapp dossier-whatsapp-desktop is-disabled" aria-disabled="true">WhatsApp tersedia setelah detail dimuat</span>
                        )}
                      </div>

                      <motion.a className="dossier-detail-link" href={`/aset/${asset.slug}`} onClick={() => handleOpenChange(false)} {...pressFeedback(reducedMotion)}><span>Lihat detail lengkap</span><ArrowRight aria-hidden="true" /></motion.a>
                    </div>
                  </div>

                  <div className="dossier-mobile-action" aria-label="Kontak BPRS">
                    {detail ? (
                      <motion.a className="dossier-whatsapp" href={detail.whatsappUrl} target="_blank" rel="noreferrer" {...pressFeedback(reducedMotion)}>
                        <WhatsappLogo aria-hidden="true" /><span>Tanyakan melalui WhatsApp</span><ArrowUpRight aria-hidden="true" />
                      </motion.a>
                    ) : (
                      <span className="dossier-whatsapp is-disabled" aria-disabled="true">WhatsApp tersedia setelah detail dimuat</span>
                    )}
                  </div>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
    <MediaLightbox
      open={lightboxOpen}
      onOpenChange={setLightboxOpen}
      images={gallery}
      activeIndex={activeImage}
      onActiveIndexChange={setActiveImage}
      assetId={asset.id}
      assetTitle={asset.title}
    />
    </>
  );
}
