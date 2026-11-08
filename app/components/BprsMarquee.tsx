"use client";

import { ArrowUpRight, Pause, Play } from "@phosphor-icons/react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { BprsProfile } from "@/app/data/catalog";
import BprsMark from "./BprsMark";
import styles from "./BprsMarquee.module.css";

export default function BprsMarquee({ profiles }: { profiles: BprsProfile[] }) {
  const [paused, setPaused] = useState(false);
  const [rail, setRail] = useState(false);
  const [duration, setDuration] = useState(60);
  const viewportRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const offsetRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const viewport = viewportRef.current;
    const list = listRef.current;
    if (!viewport || !list) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const measure = () => {
      const item = list.firstElementChild;
      if (!item) return;
      const width = item.getBoundingClientRect().width * profiles.length;
      setRail(!preference.matches && width >= viewport.clientWidth);
      // Constant 24 px/s at every viewport, independent of publisher count.
      setDuration(width / 24);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    measure();
    preference.addEventListener("change", measure);
    return () => { observer.disconnect(); preference.removeEventListener("change", measure); };
  }, [profiles.length]);
  if (profiles.length === 0) return null;
  return (
    <section className={styles.section} aria-labelledby="bprs-marquee-title" data-home-section="bprs">
      <div className={`site-frame ${styles.heading}`}>
        <div><h2 id="bprs-marquee-title">BPRS dengan aset aktif</h2><p>Lihat profil BPRS dan aset yang diterbitkannya.</p></div>
        <div className={styles.actions}>
          <a href="/bprs">Lihat semua BPRS <ArrowUpRight aria-hidden="true" /></a>
          {rail && <button type="button" aria-label={paused ? "Jalankan animasi logo" : "Jeda animasi logo"} aria-pressed={paused} onClick={() => setPaused(!paused)}>
            {paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
          </button>}
        </div>
      </div>
      {profiles.length === 1 ? (
        <div className={`site-frame ${styles.single}`} data-layout="single">
          <a href={`/bprs/${profiles[0].slug}`}><BprsMark profile={profiles[0]} /><span><strong>{profiles[0].name}</strong><small>{[profiles[0].city, profiles[0].province].filter(Boolean).join(", ")}</small></span><ArrowUpRight aria-hidden="true" /></a>
        </div>
      ) : <div ref={viewportRef} className={styles.viewport} data-layout={rail ? "rail" : "static"} data-direction="right" data-paused={paused} aria-label="Logo BPRS penerbit aktif"
        onFocus={(event) => {
          // Keep the CSS animation clock paused, but bring off-screen original
          // links into view. The visual copies never receive keyboard focus.
          const viewport = viewportRef.current;
          const offset = offsetRef.current;
          if (!rail || !viewport || !offset) return;
          viewport.scrollLeft = 0;
          const bounds = viewport.getBoundingClientRect();
          const target = event.target.getBoundingClientRect();
          const correction = target.left < bounds.left + 8 ? bounds.left + 8 - target.left
            : target.right > bounds.right - 8 ? bounds.right - 8 - target.right : 0;
          const current = Number(offset.dataset.offset || 0) + correction;
          offset.dataset.offset = String(current);
          offset.style.transform = `translateX(${current}px)`;
        }}
        onBlur={(event) => {
          if (event.currentTarget.contains(event.relatedTarget)) return;
          if (offsetRef.current) { offsetRef.current.style.transform = ""; offsetRef.current.dataset.offset = "0"; }
          event.currentTarget.scrollLeft = 0;
        }}>
        <div ref={offsetRef} className={styles.offset}>
        <div className={styles.track} style={{ "--marquee-duration": `${duration}s` } as CSSProperties}>
          {[0, 1].map((group) => (
            <ul ref={group === 0 ? listRef : undefined} className={styles.list} key={group} aria-hidden={group === 1 || undefined}>
              {profiles.map((profile) => {
                return (
                  <li key={profile.slug}>
                    <a href={`/bprs/${profile.slug}`} aria-label={group === 0 ? `Lihat profil ${profile.name}` : undefined} tabIndex={group === 1 ? -1 : undefined} title={profile.name}>
                      <BprsMark profile={profile} />
                    </a>
                  </li>
                );
              })}
            </ul>
          ))}
        </div>
        </div>
      </div>}
    </section>
  );
}
