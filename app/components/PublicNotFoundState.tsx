import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import StateIllustration from "./StateIllustration";
import styles from "./StateIllustration.module.css";
import Link from "next/link";
import SiteFooter from "./SiteFooter";
import SiteHeader from "./SiteHeader";

type MissingKind = "asset" | "bprs" | "general";

const missingCopy = {
  general: {
    label: "Alamat tidak tersedia",
    index: "Halaman tidak ditemukan",
    title: "Halaman ini tidak ada.",
    message: "Tautan mungkin sudah berubah atau alamatnya kurang tepat. Anda dapat kembali ke beranda atau langsung membuka katalog aset.",
    primaryHref: "/",
    primaryLabel: "Kembali ke beranda",
    secondaryHref: "/katalog",
    secondaryLabel: "Buka katalog",
  },
  asset: {
    label: "Aset tidak tersedia",
    index: "Aset tidak ditemukan",
    title: "Aset ini tidak dapat ditemukan.",
    message: "Aset mungkin telah ditarik, diarsipkan, atau alamatnya tidak tepat. Katalog hanya menampilkan publikasi yang masih aktif.",
    primaryHref: "/katalog",
    primaryLabel: "Kembali ke katalog",
    secondaryHref: "/bprs",
    secondaryLabel: "Lihat BPRS penerbit",
  },
  bprs: {
    label: "Penerbit tidak tersedia",
    index: "BPRS tidak ditemukan",
    title: "Profil BPRS ini tidak ditemukan.",
    message: "Profil mungkin belum aktif atau alamatnya tidak tepat. Direktori hanya memuat BPRS dengan profil dan publikasi aktif.",
    primaryHref: "/bprs",
    primaryLabel: "Kembali ke direktori",
    secondaryHref: "/katalog",
    secondaryLabel: "Buka katalog",
  },
} as const;

export default function PublicNotFoundState({ kind }: { kind: MissingKind }) {
  const copy = missingCopy[kind];

  return (
    <>
      <SiteHeader />
      <main className={`not-found-page not-found-page--${kind}`}>
        <section className="not-found-stage" aria-labelledby="not-found-title">
          <div className={`not-found-index ${styles.errorIndex}`} aria-hidden="true">
            <strong>404</strong>
            <StateIllustration scene="missing" />
            <span>{copy.index}</span>
          </div>
          <div className="not-found-copy">
            <p className="eyebrow">{copy.label}</p>
            <h1 id="not-found-title">{copy.title}</h1>
            <p>{copy.message}</p>
            <div className="not-found-actions">
              <Link className="button-primary" href={copy.primaryHref}>
                <span>{copy.primaryLabel}</span>
                <ArrowRight aria-hidden="true" />
              </Link>
              <Link className="text-link" href={copy.secondaryHref}>
                <span>{copy.secondaryLabel}</span>
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
