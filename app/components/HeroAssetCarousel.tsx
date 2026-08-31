"use client";

import { ArrowLeft, ArrowRight, ArrowUpRight, MapPin, ShieldCheck } from "@phosphor-icons/react";
import useEmblaCarousel from "embla-carousel-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useState, type KeyboardEvent } from "react";
import type { Asset } from "../data/catalog";
import { pressFeedback, PUBLIC_MOTION_DURATION, PUBLIC_MOTION_EASE } from "../lib/public-motion";
import PublicMedia from "./PublicMedia";

export default function HeroAssetCarousel({ slides }: { slides: Asset[] }) {
  const reducedMotion = useReducedMotion();
  const interactive = slides.length > 1;
  const [viewportRef, embla] = useEmblaCarousel({ loop: false, align: "start", watchDrag: interactive });
  const [selected, setSelected] = useState(0);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(interactive);

  const sync = useCallback(() => {
    if (!embla) return;
    setSelected(embla.selectedScrollSnap());
    setCanScrollPrev(embla.canScrollPrev());
    setCanScrollNext(embla.canScrollNext());
  }, [embla]);

  useEffect(() => {
    if (!embla) return;
    const frame = window.requestAnimationFrame(sync);
    embla.on("select", sync);
    embla.on("reInit", sync);
    return () => {
      window.cancelAnimationFrame(frame);
      embla.off("select", sync);
      embla.off("reInit", sync);
    };
  }, [embla, sync]);

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLElement>) => {
    if (!embla || !interactive) return;
    if (event.key === "ArrowLeft" && embla.canScrollPrev()) {
      event.preventDefault();
      embla.scrollPrev();
    }
    if (event.key === "ArrowRight" && embla.canScrollNext()) {
      event.preventDefault();
      embla.scrollNext();
    }
  }, [embla, interactive]);

  const active = slides[selected] ?? slides[0];
  if (!active) return null;

  return (
    <section className="hero site-frame" aria-labelledby="hero-title">
      <div className="hero-copy">
        <p className="hero-kicker"><span>01</span> Katalog publik aset BPRS</p>
        <h1 id="hero-title">Temukan aset.<br />Kenali penerbitnya.</h1>
        <p className="hero-intro">Telusuri aset yang diterbitkan langsung oleh BPRS melalui ruwang, lengkap dengan lokasi dan jalur kontak penerbitnya.</p>
        <div className="hero-actions">
          <motion.a className="button-primary" href="/katalog" {...pressFeedback(reducedMotion)}><span>Jelajahi katalog</span><ArrowRight aria-hidden="true" /></motion.a>
          <motion.a className="text-link" href="/bprs" {...pressFeedback(reducedMotion)}><span>Lihat BPRS penerbit</span><ArrowUpRight aria-hidden="true" /></motion.a>
        </div>
        <p className="hero-assurance"><ShieldCheck aria-hidden="true" /><span>Tanpa akun</span><i aria-hidden="true" /><span>Informasi lanjutan melalui BPRS</span></p>
      </div>

      <div
        className={`hero-showcase ${interactive ? "is-interactive" : "is-single"}`}
        role="region"
        aria-roledescription="carousel"
        aria-label="Preview aset terbaru"
      >
        <div className="hero-viewport" ref={viewportRef} id="home-asset-carousel">
          <div className="hero-slides">
            {slides.map((asset, index) => (
              <a className="hero-slide" href={`/aset/${asset.slug}`} key={asset.id} aria-label={`${index + 1} dari ${slides.length}: buka detail ${asset.title}`} tabIndex={index === selected ? 0 : -1} onKeyDown={handleKeyDown}>
                <PublicMedia
                  src={asset.cover.url}
                  alt={asset.cover.altText}
                  width={asset.cover.width}
                  height={asset.cover.height}
                  sizes="(max-width: 900px) 94vw, 55vw"
                  preload={asset.id === slides[0]?.id}
                />
              </a>
            ))}
          </div>
        </div>

        <div className="hero-folio" aria-hidden="true">{active.id.replace("-", " — ")}</div>
        <div className="hero-caption" aria-live="polite" aria-atomic="true">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              className="hero-caption-copy"
              key={active.id}
              initial={reducedMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reducedMotion ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: PUBLIC_MOTION_DURATION.standard, ease: PUBLIC_MOTION_EASE }}
            >
              <small>{active.categoryLabel} · {active.publisher.name}</small>
              <a href={`/aset/${active.slug}`} onKeyDown={handleKeyDown}>{active.title}</a>
              <span><MapPin aria-hidden="true" /> {active.city}, {active.province}</span>
            </motion.div>
          </AnimatePresence>
          {interactive ? (
            <div className="hero-navigation">
              <div className="hero-progress" aria-label={`Slide ${selected + 1} dari ${slides.length}`}>
                <span>{String(selected + 1).padStart(2, "0")}</span>
                <i><b style={{ width: `${((selected + 1) / slides.length) * 100}%` }} /></i>
                <span>{String(slides.length).padStart(2, "0")}</span>
              </div>
              <div className="hero-arrows">
                <motion.button type="button" onClick={() => embla?.scrollPrev()} onKeyDown={handleKeyDown} disabled={!canScrollPrev} aria-controls="home-asset-carousel" aria-label="Aset sebelumnya" {...pressFeedback(reducedMotion)}><ArrowLeft aria-hidden="true" /></motion.button>
                <motion.button type="button" onClick={() => embla?.scrollNext()} onKeyDown={handleKeyDown} disabled={!canScrollNext} aria-controls="home-asset-carousel" aria-label="Aset berikutnya" {...pressFeedback(reducedMotion)}><ArrowRight aria-hidden="true" /></motion.button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
