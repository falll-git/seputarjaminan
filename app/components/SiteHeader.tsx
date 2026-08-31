"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ArrowUpRight, List, X } from "@phosphor-icons/react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import BrandLockup from "./BrandLockup";

const nav = [
  { href: "/katalog", label: "Katalog" },
  { href: "/bprs", label: "BPRS penerbit" },
  { href: "/cara-minat", label: "Cara minat" },
];

export default function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const pathname = usePathname();

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
        <div className="site-frame header-inner">
          <BrandLockup />
          <nav className="desktop-nav" aria-label="Navigasi utama">
            {nav.map((item) => <a href={item.href} aria-current={isActive(item.href) ? "page" : undefined} key={item.href}>{item.label}</a>)}
          </nav>
          <a className="header-cta" href="/katalog">
            <span>Jelajahi aset</span>
            <ArrowUpRight aria-hidden="true" />
          </a>
          <Dialog.Root open={open} onOpenChange={setOpen}>
            <Dialog.Trigger asChild>
              <button className="mobile-menu-trigger" type="button" aria-label="Buka navigasi" aria-expanded={open}>
                <List aria-hidden="true" />
              </button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="mobile-navigation-overlay" />
              <Dialog.Content className="mobile-navigation" aria-describedby="mobile-navigation-description">
                <Dialog.Title className="sr-only">Navigasi utama</Dialog.Title>
                <div className="mobile-navigation-head">
                  <BrandLockup inverted />
                  <Dialog.Close asChild><button type="button" aria-label="Tutup navigasi"><X aria-hidden="true" /></button></Dialog.Close>
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
                <Dialog.Description id="mobile-navigation-description">Katalog publik dari BPRS melalui ruwang.</Dialog.Description>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </div>
      </header>
  );
}
