"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ArrowUpRight, List, X } from "@phosphor-icons/react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import BrandLockup from "./BrandLockup";
import ThemeControl from "./ThemeControl";
import { Button, SearchInput, IconButton } from "./ui";
import styles from "./HomeSearch.module.css";
import { publicNavigation as nav } from "../lib/public-navigation";


export default function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const pathname = usePathname();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let frame = 0;

    function updateHeader() {
      frame = 0;
      setCompact(window.scrollY > 28);
    }

    function handleScroll() {
      if (!frame) frame = window.requestAnimationFrame(updateHeader);
    }

    updateHeader();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  function isActive(href: string) {
    if (href === "/katalog" && pathname.startsWith("/aset/")) return true;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
      <header className={`site-header${compact ? " is-compact" : ""}`} data-compact={compact ? "true" : "false"}>
        <div className={`site-frame header-inner${pathname === "/" ? ` ${styles.inner}` : ""}`}>
          <BrandLockup />
          {pathname === "/" && <form action="/katalog" role="search" className={`${styles.search} sj-search-bar`}>
            <SearchInput label="Cari aset atau lokasi" hideLabel id="home-search" name="q" maxLength={100} placeholder="Cari aset atau lokasi…" />
            <Button type="submit">Cari</Button>
          </form>}
          <nav className="desktop-nav" aria-label="Navigasi utama">
            {nav.map((item) => <a href={item.href} aria-current={isActive(item.href) ? "page" : undefined} key={item.href}>{item.label}</a>)}
          </nav>
          <div className="desktop-theme-control"><ThemeControl /></div>
          <Dialog.Root open={open} onOpenChange={setOpen}>
            <Dialog.Trigger asChild>
              <IconButton ref={triggerRef} className="mobile-menu-trigger" label="Buka navigasi" aria-expanded={open}>
                <List aria-hidden="true" />
              </IconButton>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="mobile-navigation-overlay" />
              <Dialog.Content className="mobile-navigation" aria-describedby="mobile-navigation-description"
                onOpenAutoFocus={(event) => { event.preventDefault(); closeRef.current?.focus({ preventScroll: true }); }}
                onCloseAutoFocus={(event) => { event.preventDefault(); triggerRef.current?.focus({ preventScroll: true }); }}>
                <Dialog.Title className="sr-only">Navigasi utama</Dialog.Title>
                <div className="mobile-navigation-head">
                  <BrandLockup />
                  <Dialog.Close asChild><IconButton ref={closeRef} label="Tutup navigasi"><X aria-hidden="true" /></IconButton></Dialog.Close>
                </div>
                <nav aria-label="Navigasi utama">
                  {nav.map((item, index) => {
                    const active = isActive(item.href);
                    return (
                    <Dialog.Close asChild key={item.href}>
                      <a href={item.href} aria-current={active ? "page" : undefined}>
                        <span>0{index + 1}</span>
                        <strong>{item.label}</strong>
                        <ArrowUpRight weight={active ? "bold" : "regular"} aria-hidden="true" />
                      </a>
                    </Dialog.Close>
                    );
                  })}
                </nav>
                <div className="mobile-theme-control">
                  <ThemeControl />
                  <Dialog.Description id="mobile-navigation-description">Katalog publik dari BPRS melalui ruwang.</Dialog.Description>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </div>
      </header>
  );
}
