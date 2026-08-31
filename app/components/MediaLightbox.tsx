"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ArrowLeft, ArrowRight, X } from "@phosphor-icons/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { AssetMedia } from "@/app/data/catalog";
import { pressFeedback, PUBLIC_MOTION_DURATION, PUBLIC_MOTION_EASE } from "@/app/lib/public-motion";
import PublicMedia from "./PublicMedia";

type MediaLightboxProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  images: AssetMedia[];
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  assetId: string;
  assetTitle: string;
};

export default function MediaLightbox({
  open,
  onOpenChange,
  images,
  activeIndex,
  onActiveIndexChange,
  assetId,
  assetTitle,
}: MediaLightboxProps) {
  const reducedMotion = useReducedMotion();
  const activeImage = images[activeIndex] ?? images[0];
  if (!activeImage) return null;

  const move = (direction: number) => {
    onActiveIndexChange((activeIndex + direction + images.length) % images.length);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="media-lightbox-overlay"
                initial={reducedMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: PUBLIC_MOTION_DURATION.fast }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount aria-describedby={undefined}>
              <motion.div
                className="media-lightbox"
                initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.985 }}
                animate={reducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
                exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.995 }}
                transition={{ duration: PUBLIC_MOTION_DURATION.slow, ease: PUBLIC_MOTION_EASE }}
              >
                <header className="media-lightbox-header">
                  <div>
                    <span>{assetId}</span>
                    <Dialog.Title>{assetTitle}</Dialog.Title>
                  </div>
                  <Dialog.Close asChild>
                    <motion.button type="button" aria-label="Tutup galeri layar penuh" {...pressFeedback(reducedMotion)}><X aria-hidden="true" /></motion.button>
                  </Dialog.Close>
                </header>

                <div className="media-lightbox-stage">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      className="media-lightbox-image"
                      key={`${activeImage.url}-${activeIndex}`}
                      initial={reducedMotion ? false : { opacity: 0, x: 14 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={reducedMotion ? undefined : { opacity: 0, x: -14 }}
                      transition={{ duration: PUBLIC_MOTION_DURATION.standard, ease: PUBLIC_MOTION_EASE }}
                    >
                      <PublicMedia
                        src={activeImage.url}
                        alt={activeImage.altText}
                        width={activeImage.width}
                        height={activeImage.height}
                        sizes="100vw"
                        fit="contain"
                      />
                    </motion.div>
                  </AnimatePresence>

                  {images.length > 1 && (
                    <nav className="media-lightbox-arrows" aria-label="Navigasi galeri layar penuh">
                      <motion.button type="button" onClick={() => move(-1)} aria-label="Foto sebelumnya" {...pressFeedback(reducedMotion)}><ArrowLeft aria-hidden="true" /></motion.button>
                      <motion.button type="button" onClick={() => move(1)} aria-label="Foto berikutnya" {...pressFeedback(reducedMotion)}><ArrowRight aria-hidden="true" /></motion.button>
                    </nav>
                  )}
                </div>

                <footer className="media-lightbox-footer">
                  <span>Visual publikasi dari BPRS penerbit</span>
                  <strong>{String(activeIndex + 1).padStart(2, "0")} / {String(images.length).padStart(2, "0")}</strong>
                </footer>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
