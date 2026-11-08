"use client";

import { ArrowLeft, ArrowRight, MapPin, Pause, Play } from "@phosphor-icons/react";
import useEmblaCarousel from "embla-carousel-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import type { Asset } from "../data/catalog";
import PublicMedia from "./PublicMedia";
import { StatusBadge } from "./ui";
import styles from "./HeroAssetCarousel.module.css";

const motionQuery = "(prefers-reduced-motion: reduce)";
function subscribeMotion(change: () => void) {
  const query = window.matchMedia(motionQuery);
  query.addEventListener("change", change);
  return () => query.removeEventListener("change", change);
}
const browserReducedMotion = () => window.matchMedia(motionQuery).matches;
// Keep SSR and initial hydration identical; rotation starts only after preference is known.
const serverReducedMotion = () => true;

export default function HeroAssetCarousel({ slides }: { slides: Asset[] }) {
  const reducedMotion = useSyncExternalStore(subscribeMotion, browserReducedMotion, serverReducedMotion);
  const interactive = slides.length > 1;
  const [viewportRef, embla] = useEmblaCarousel({ loop: interactive, align: "start", containScroll: false, watchDrag: interactive, duration: reducedMotion ? 0 : 20 });
  const region = useRef<HTMLDivElement>(null);
  const rotationWasPlaying = useRef(false);
  const [selected, setSelected] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [visible, setVisible] = useState(false);
  const [tabVisible, setTabVisible] = useState(true);
  const [inView, setInView] = useState<number[]>([0, 1]);
  const playing = interactive && !reducedMotion && !paused;
  const pause = useCallback(() => setPaused(true), []);
  useEffect(() => {
    if (!embla) return;
    const sync = () => { setSelected(embla.selectedScrollSnap()); setInView(embla.slidesInView()); };
    const frame = requestAnimationFrame(sync);
    embla.on("select", sync).on("slidesInView", sync).on("reInit", sync).on("pointerDown", pause);
    return () => { cancelAnimationFrame(frame); embla.off("select", sync).off("slidesInView", sync).off("reInit", sync).off("pointerDown", pause); };
  }, [embla, pause]);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: .35 });
    if (region.current) observer.observe(region.current);
    const update = () => setTabVisible(!document.hidden);
    update(); document.addEventListener("visibilitychange", update);
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", update); };
  }, []);
  useEffect(() => {
    if (!embla || !playing || hovered || !visible || !tabVisible) return;
    const timer = window.setTimeout(() => {
      if (embla.canScrollNext()) embla.scrollNext(); else embla.scrollTo(0);
    }, 6000);
    return () => window.clearTimeout(timer);
  }, [embla, playing, hovered, visible, tabVisible, selected]);
  function move(direction: number) {
    pause(); if (!embla) return;
    if (direction > 0) { if (embla.canScrollNext()) embla.scrollNext(Boolean(reducedMotion)); else embla.scrollTo(0, Boolean(reducedMotion)); }
    else { if (embla.canScrollPrev()) embla.scrollPrev(Boolean(reducedMotion)); else embla.scrollTo(slides.length - 1, Boolean(reducedMotion)); }
  }
  function keyboard(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); move(event.key === "ArrowLeft" ? -1 : 1); }
  }
  if (!slides.length) return null;
  return <div ref={region} className={styles.showcase} data-count={slides.length} role="region" aria-roledescription="carousel" aria-label="Jelajahi aset" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocusCapture={pause}>
    <div className={styles.viewport} ref={viewportRef} id="home-asset-carousel">
      <div className={styles.slides}>{slides.map((asset, index) => <article className={styles.slide} key={asset.id} aria-roledescription="slide" aria-label={`${index + 1} dari ${slides.length}`}>
        <a className={styles.photo} href={`/aset/${asset.slug}`} onKeyDown={keyboard} tabIndex={inView.includes(index) ? 0 : -1} aria-label={`Lihat foto dan detail ${asset.title}`}>
          <PublicMedia src={asset.cover.url} alt={asset.cover.altText} width={asset.cover.width} height={asset.cover.height} sizes="(max-width: 760px) 85vw, 44vw" preload={index === 0} variant="card" />
        </a>
        <div className={styles.caption}>
          <div className={styles.meta}><span>{asset.categoryLabel}</span><StatusBadge>{asset.status}</StatusBadge></div>
          <h2><a href={`/aset/${asset.slug}`} tabIndex={inView.includes(index) ? 0 : -1}>{asset.title}</a></h2>
          <p className={styles.location}><MapPin aria-hidden="true"/>{asset.city}, {asset.province}</p>
          <div className={styles.foot}><span>{asset.publisher.name}</span><a href={`/aset/${asset.slug}`} tabIndex={inView.includes(index) ? 0 : -1}>Lihat detail <ArrowRight aria-hidden="true"/></a></div>
        </div>
      </article>)}</div>
    </div>
    {interactive && <div className={styles.navigation}>
      <button type="button" aria-label="Aset sebelumnya" aria-controls="home-asset-carousel" onKeyDown={keyboard} onClick={() => move(-1)}><ArrowLeft aria-hidden="true"/></button>
      <div className={styles.dots} aria-label="Pilih aset">{slides.map((asset, index) => <button type="button" key={asset.id} aria-label={`Tampilkan aset ${index + 1}`} aria-current={selected === index ? "true" : undefined} onClick={() => { pause(); embla?.scrollTo(index, Boolean(reducedMotion)); }}><span/></button>)}</div>
      <button type="button" aria-label="Aset berikutnya" aria-controls="home-asset-carousel" onKeyDown={keyboard} onClick={() => move(1)}><ArrowRight aria-hidden="true"/></button>
      {!reducedMotion && <button type="button" aria-label={playing ? "Jeda carousel" : "Putar carousel"} onPointerDown={() => { rotationWasPlaying.current = playing; }} onClick={event => setPaused(event.detail > 0 ? rotationWasPlaying.current : !paused)}>{playing ? <Pause aria-hidden="true"/> : <Play aria-hidden="true"/>}</button>}
      <span className="sr-only" aria-live={playing ? "off" : "polite"}>Aset {selected + 1} dari {slides.length}</span>
    </div>}
  </div>;
}
