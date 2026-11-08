"use client";

import { ArrowLeft, ArrowRight, ArrowsOut, ImageSquare } from "@phosphor-icons/react";
import { useReducedMotion } from "motion/react";
import PhotoSwipeLightbox from "photoswipe/lightbox";
import { useEffect, useRef, useState } from "react";
import type { AssetMedia } from "@/app/data/catalog";
import PublicMedia from "./PublicMedia";
import PublicDataState from "./PublicDataState";

type AssetDetailGalleryProps = {
  assetId: string;
  assetTitle: string;
  images: AssetMedia[];
};

const phosphorArrowLeftSvg = '<svg aria-hidden="true" class="pswp__icn" width="32" height="32" viewBox="0 0 256 256" fill="currentColor"><path d="M224,128a8,8,0,0,1-8,8H59.31l58.35,58.34a8,8,0,0,1-11.32,11.32l-72-72a8,8,0,0,1,0-11.32l72-72a8,8,0,0,1,11.32,11.32L59.31,120H216A8,8,0,0,1,224,128Z"/></svg>';
const phosphorArrowRightSvg = '<svg aria-hidden="true" class="pswp__icn" width="32" height="32" viewBox="0 0 256 256" fill="currentColor"><path transform="translate(256 0) scale(-1 1)" d="M224,128a8,8,0,0,1-8,8H59.31l58.35,58.34a8,8,0,0,1-11.32,11.32l-72-72a8,8,0,0,1,0-11.32l72-72a8,8,0,0,1,11.32,11.32L59.31,120H216A8,8,0,0,1,224,128Z"/></svg>';
const phosphorCloseSvg = '<svg aria-hidden="true" class="pswp__icn" width="32" height="32" viewBox="0 0 256 256" fill="currentColor"><path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"/></svg>';
const phosphorZoomSvg = '<svg aria-hidden="true" class="pswp__icn" width="32" height="32" viewBox="0 0 256 256" fill="currentColor"><path d="M152,112a8,8,0,0,1-8,8H120v24a8,8,0,0,1-16,0V120H80a8,8,0,0,1,0-16h24V80a8,8,0,0,1,16,0v24h24A8,8,0,0,1,152,112Zm77.66,117.66a8,8,0,0,1-11.32,0l-50.06-50.07a88.11,88.11,0,1,1,11.31-11.31l50.07,50.06A8,8,0,0,1,229.66,229.66ZM112,184a72,72,0,1,0-72-72A72.08,72.08,0,0,0,112,184Z"/></svg>';

export default function AssetDetailGallery({ assetId, assetTitle, images }: AssetDetailGalleryProps) {
  const galleryRef = useRef<HTMLElement>(null);
  const reducedMotion = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);
  const activeImage = images[activeIndex] ?? images[0];

  useEffect(() => {
    const gallery = galleryRef.current;
    if (!gallery || images.length === 0) return;

    const lightbox = new PhotoSwipeLightbox({
      gallery,
      children: "a.asset-gallery-slide",
      pswpModule: () => import("photoswipe"),
      mainClass: "sj-photoswipe",
      bgOpacity: 0.96,
      showHideAnimationType: reducedMotion ? "none" : "fade",
      showAnimationDuration: reducedMotion ? 0 : 280,
      hideAnimationDuration: reducedMotion ? 0 : 220,
      zoomAnimationDuration: reducedMotion ? 0 : 280,
      wheelToZoom: true,
      initialZoomLevel: "fit",
      secondaryZoomLevel: 1.5,
      maxZoomLevel: 3,
      preload: [1, 2],
      loop: images.length > 2,
      closeTitle: "Tutup galeri",
      zoomTitle: "Perbesar atau perkecil foto",
      arrowPrevTitle: "Foto sebelumnya",
      arrowNextTitle: "Foto berikutnya",
      arrowPrevSVG: phosphorArrowLeftSvg,
      arrowNextSVG: phosphorArrowRightSvg,
      closeSVG: phosphorCloseSvg,
      zoomSVG: phosphorZoomSvg,
      errorMsg: "Foto belum dapat dimuat.",
      indexIndicatorSep: " / ",
      paddingFn: (viewport) => viewport.x <= 720
        ? { top: 72, bottom: 86, left: 12, right: 12 }
        : { top: 92, bottom: 92, left: 72, right: 72 },
    });

    lightbox.on("change", () => {
      if (lightbox.pswp) setActiveIndex(lightbox.pswp.currIndex);
    });

    lightbox.on("bindEvents", () => {
      lightbox.pswp?.element?.setAttribute("aria-modal", "true");
      lightbox.pswp?.element?.setAttribute("aria-label", `Galeri foto ${assetTitle}`);
    });

    // Cycle at both ends: the library's focusin guard alone lets Tab briefly
    // escape to browser chrome after its last control.
    lightbox.on("keydown", (event) => {
      const key = event.originalEvent;
      const root = lightbox.pswp?.element;
      if (key.key !== "Tab" || key.ctrlKey || key.altKey || key.metaKey || !root) return;
      const controls = Array.from(root.querySelectorAll<HTMLElement>("button, a[href], input, select, textarea, [tabindex='0']"))
        .filter((element) => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden" && element.tabIndex >= 0 && !element.matches(":disabled"));
      event.preventDefault();
      key.preventDefault();
      const index = controls.indexOf(document.activeElement as HTMLElement);
      const next = key.shiftKey ? (index <= 0 ? controls.length - 1 : index - 1) : (index + 1) % controls.length;
      (controls[next] ?? root).focus({ preventScroll: true });
    });

    lightbox.on("closingAnimationEnd", () => {
      window.requestAnimationFrame(() => {
        gallery.querySelector<HTMLElement>(".asset-gallery-slide.is-active")?.focus({ preventScroll: true });
      });
    });

    lightbox.on("uiRegister", () => {
      lightbox.pswp?.ui?.registerElement({
        name: "asset-context",
        className: "sj-photoswipe-context",
        appendTo: "root",
        order: 8,
        onInit: (element, pswp) => {
          const updateContext = () => {
            const current = images[pswp.currIndex];
            element.textContent = `${assetId} · ${String(pswp.currIndex + 1).padStart(2, "0")} / ${String(images.length).padStart(2, "0")} · ${current?.altText || assetTitle}`;
          };
          pswp.on("change", updateContext);
          updateContext();
        },
      });
    });

    lightbox.init();
    return () => lightbox.destroy();
  }, [assetId, assetTitle, images, reducedMotion]);

  if (!activeImage) return <section className="asset-gallery" aria-label={`Galeri visual ${assetTitle}`}><PublicDataState kind="empty" scene="photo" title="Foto aset belum tersedia." message="Informasi aset yang tersedia tetap dapat dibaca di halaman ini." /></section>;

  const showPrevious = () => setActiveIndex((index) => (index - 1 + images.length) % images.length);
  const showNext = () => setActiveIndex((index) => (index + 1) % images.length);

  return (
    <section ref={galleryRef} className={`asset-gallery ${images.length > 1 ? "has-multiple" : "is-single"}`} aria-label={`Galeri visual ${assetTitle}`}>
      <figure className="asset-gallery-figure">
        <div className="asset-gallery-stage">
          {images.map((image, index) => {
            const isActive = index === activeIndex;
            return (
              <a
                className={`asset-gallery-slide${isActive ? " is-active" : ""}`}
                href={image.url}
                data-pswp-width={image.width}
                data-pswp-height={image.height}
                data-cropped="true"
                target="_blank"
                rel="noreferrer"
                aria-label={`Buka foto ${index + 1} dari ${images.length} pada layar penuh`}
                aria-hidden={isActive ? undefined : true}
                tabIndex={isActive ? 0 : -1}
                onKeyDown={(event) => {
                  if (images.length < 2 || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
                  event.preventDefault();
                  const next = (activeIndex + (event.key === "ArrowRight" ? 1 : -1) + images.length) % images.length;
                  setActiveIndex(next);
                  window.requestAnimationFrame(() => galleryRef.current?.querySelectorAll<HTMLElement>(".asset-gallery-slide")[next]?.focus({ preventScroll: true }));
                }}
                key={`${image.url}-${index}`}
              >
                {isActive && (
                    <span
                      className="asset-gallery-image-frame"
                      key={`${image.url}-${index}`}
                    >
                      <PublicMedia
                        fit="contain"
                        src={image.url}
                        alt={image.altText}
                        width={image.width}
                        height={image.height}
                        sizes="(max-width: 760px) 100vw, 55vw"
                        preload={index === 0}
                      />
                    </span>
                )}
                <span className="asset-gallery-expand"><ArrowsOut aria-hidden="true" /> <span>Buka layar penuh</span></span>
              </a>
            );
          })}
        </div>

        <figcaption className="asset-gallery-caption" aria-live="polite" aria-atomic="true">
          <span className="asset-gallery-index"><strong>{assetId}</strong><span aria-hidden="true">·</span> visual {String(activeIndex + 1).padStart(2, "0")}</span>
          <span><ImageSquare aria-hidden="true" /> {String(activeIndex + 1).padStart(2, "0")} / {String(images.length).padStart(2, "0")}</span>
        </figcaption>

        {images.length > 1 && (
          <div className="asset-gallery-arrows" aria-label="Navigasi galeri">
            <button type="button" onClick={showPrevious} aria-label="Foto sebelumnya"><ArrowLeft aria-hidden="true" /></button>
            <button type="button" onClick={showNext} aria-label="Foto berikutnya"><ArrowRight aria-hidden="true" /></button>
          </div>
        )}
      </figure>

      {images.length > 1 && (
        <div className="asset-gallery-rail">
          <div className="asset-gallery-rail-meta">
            <span>Pilih sudut foto</span>
            <small>Geser daftar untuk melihat foto lainnya</small>
          </div>
          <div className="asset-gallery-thumbnails" aria-label="Pilih foto">
            {images.map((image, index) => (
              <button
                className={index === activeIndex ? "is-active" : undefined}
                type="button"
                key={`${image.url}-${index}`}
                onClick={() => setActiveIndex(index)}
                aria-label={`Tampilkan foto ${index + 1}`}
                aria-pressed={index === activeIndex}
              >
                <PublicMedia
                  src={image.url}
                  alt={image.altText}
                  width={image.width}
                  height={image.height}
                  sizes="128px"
                  variant="thumb"
                  decorative
                  compact
                />
                <span className="asset-gallery-thumbnail-index">{String(index + 1).padStart(2, "0")}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="asset-gallery-disclosure">Gambar publikasi disediakan oleh BPRS penerbit dan bukan pengganti dokumen legal aset.</p>
    </section>
  );
}
