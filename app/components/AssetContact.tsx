"use client";

import { ArrowUpRight, WhatsappLogo } from "@phosphor-icons/react";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { assetWhatsappHref, publicationWhatsappDestination } from "../lib/public-whatsapp";
import { Button } from "./ui";
import styles from "./AssetContact.module.css";

type Props = { configuredUrl: string; title: string; reference: string; publisherName: string; mobile?: boolean };
const subscribe = () => () => {};
const browserOrigin = () => window.location.origin;
const serverOrigin = () => "";

export default function AssetContact({ configuredUrl, title, reference, publisherName, mobile = false }: Props) {
  // Stable SSR snapshot; use the actual public browser origin, never an internal API host or returnTo query.
  const origin = useSyncExternalStore(subscribe, browserOrigin, serverOrigin);
  const validDestination = publicationWhatsappDestination(configuredUrl);
  const href = origin ? assetWhatsappHref(configuredUrl, title, reference, origin) : null;
  const dock = useRef<HTMLDivElement>(null);
  const spacer = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!mobile || !dock.current || !spacer.current) return;
    const update = () => {
      if (!spacer.current || !dock.current) return;
      const height = dock.current.getBoundingClientRect().height;
      spacer.current.style.height = `${height}px`;
      document.documentElement.style.setProperty("--contact-dock-height", `${height}px`);
    };
    const observer = new ResizeObserver(update);
    observer.observe(dock.current);
    update();
    return () => { observer.disconnect(); document.documentElement.style.removeProperty("--contact-dock-height"); };
  }, [mobile]);

  const action = href ? (
    <a className={`ui-button ui-button-primary ${styles.action}`} href={href} target="_blank" rel="noopener noreferrer" aria-label={`Hubungi BPRS melalui WhatsApp: ${publisherName}`}>
      <WhatsappLogo aria-hidden="true" /><span>Hubungi BPRS</span><ArrowUpRight aria-hidden="true" />
    </a>
  ) : <Button className={styles.action} disabled><WhatsappLogo aria-hidden="true" />{validDestination && !origin ? "Menyiapkan WhatsApp…" : "Kontak belum tersedia"}</Button>;
  const note = !validDestination || (origin && !href)
    ? "Tautan WhatsApp publikasi ini belum valid. Silakan periksa kembali nanti."
    : "Pesan dapat diedit di WhatsApp sebelum dikirim.";

  if (mobile) return <div ref={spacer} className={styles.spacer} data-contact-spacer>
    <div ref={dock} className={styles.dock} data-mobile-contact>
      <p>Hubungi <strong>{publisherName}</strong></p>
      {action}
      {!validDestination && <small>{note}</small>}
    </div>
  </div>;

  return <div className={styles.inline} data-asset-contact>{action}<p role="status">{note}</p><noscript>Aktifkan JavaScript untuk menyiapkan tautan WhatsApp aset ini.</noscript></div>;
}
