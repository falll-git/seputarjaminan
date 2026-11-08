"use client";

import { ArrowClockwise, ArrowRight } from "@phosphor-icons/react";
import StateIllustration from "./StateIllustration";
import styles from "./StateIllustration.module.css";
import Link from "next/link";
import SiteFooter from "./SiteFooter";
import SiteHeader from "./SiteHeader";

export default function UnexpectedErrorPage({ retry }: { retry: () => void }) {
  return (
    <>
      <SiteHeader />
      <main className="unexpected-error-page">
        <section className="unexpected-error-stage" aria-labelledby="unexpected-error-title">
          <div className={`unexpected-error-index ${styles.errorIndex}`} aria-hidden="true">
            <strong>500</strong>
            <StateIllustration scene="error" />
            <span>Gangguan tidak terduga</span>
          </div>
          <div className="unexpected-error-copy">
            <p className="eyebrow">Halaman belum dapat ditampilkan</p>
            <h1 id="unexpected-error-title">Ada bagian yang belum berhasil dimuat.</h1>
            <p>Informasi contoh tidak akan ditampilkan sebagai pengganti. Coba muat kembali halaman atau kembali ke beranda.</p>
            <div className="unexpected-error-actions">
              <button className="button-primary" type="button" onClick={retry}>
                <span>Coba lagi</span>
                <ArrowClockwise aria-hidden="true" />
              </button>
              <Link className="text-link" href="/">
                <span>Kembali ke beranda</span>
                <ArrowRight aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
