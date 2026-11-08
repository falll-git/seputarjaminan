import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ThemeControl from "@/app/components/ThemeControl";
import styles from "./preview.module.css";
import SharedPreview from "./SharedPreview";
import VisualAuditPreview from "./VisualAuditPreview";

export const metadata: Metadata = { title: "Fondasi desain — development", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const swatches = ["background", "surface", "surface-elevated", "text", "text-supporting", "placeholder", "action", "action-hover", "action-active", "on-action", "link", "link-hover", "link-active", "focus", "disabled-surface", "disabled-text", "disabled-border", "border", "divider", "control-border", "accent-surface", "status-available-surface", "status-available-text", "status-error-surface", "status-error-text", "status-warning-surface", "status-warning-text", "status-info-surface", "status-info-text", "logo-surface"];

export default function DesignSystemPreview() {
  // Never expose preview/sample controls outside next dev, even by direct URL.
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div><p className={styles.eyebrow}>Development only · Tahap 2</p><h1>Chalk, indigo, sage.</h1><p>Fondasi visual, bukan rancangan ulang halaman katalog. Semua contoh di sini hanya untuk inspeksi UI.</p></div>
        <ThemeControl />
      </header>
      <section aria-labelledby="type-heading" className={styles.typography}>
        <h2 id="type-heading">Manrope untuk judul. Source Sans 3 untuk membaca.</h2>
        <p>Telusuri aset BPRS, baca informasi dasarnya, lalu hubungi penerbit. Uji karakter: 126 m² · Rp · é · 0123456789.</p>
        <div className={styles.spacing}>{[1, 2, 3, 4, 6, 8, 12].map((step) => <span key={step}><i style={{ width: `var(--space-${step})` }} /><code>space-{step}</code></span>)}</div>
      </section>
      <div className={styles.themes}>
        {(["light", "dark"] as const).map((theme) => (
          <section className={styles.panel} data-preview-theme={theme} key={theme} aria-label={`Token ${theme}`}>
            <h2>{theme === "light" ? "Terang" : "Gelap"}</h2>
            <p className={styles.supporting}>Pasangan token yang sama, konteks permukaan berbeda.</p>
            <div className={styles.swatches}>{swatches.map((token) => <div key={token}><i style={{ "--swatch": `var(--color-${token})` } as CSSProperties} /><code>--color-{token}</code></div>)}</div>
            <div className={styles.elevated}>
              <h3>Komponen dasar</h3>
              <p>Permukaan elevated untuk dialog, popover, dan kontrol yang perlu terpisah dari latar.</p>
              <div className={styles.actions}><button className="foundation-action" type="button">Aksi utama</button><button className="foundation-action" type="button" disabled>Tidak tersedia</button><a className="foundation-link" href="#type-heading">Contoh tautan</a></div>
              <label className={styles.field}>Pencarian contoh<input className="foundation-input" placeholder="Ketik jenis aset atau lokasi" /></label>
              <label className={styles.field}>Kontrol nonaktif<input className="foundation-input" value="Belum dapat dipilih" disabled readOnly /></label>
              <label className={styles.field}>Contoh kesalahan input<input className="foundation-input" aria-invalid="true" aria-describedby={`error-${theme}`} defaultValue="Contoh" /></label>
              <p id={`error-${theme}`} className={styles.error}>Contoh pesan: periksa kembali isian.</p>
              <span className="foundation-badge">Tersedia</span><p className={styles.supporting}>Satu-satunya status aset publik yang didukung. Warna error/info adalah state UI, bukan status aset baru.</p>
              <div className={styles.logo}><strong>BPRS</strong><small>Alas logo netral · tanpa filter gambar</small></div>
            </div>
          </section>
        ))}
      </div>
      <SharedPreview />
      <VisualAuditPreview />
      <section className={styles.typography}><h2>Inspeksi interaksi</h2><p>Gunakan Tab untuk focus ring, hover/tekan tombol, ubah Tema, lalu reload. Uji juga preferensi perangkat dan reduced motion. Foto publik tidak diberi filter atau inversi warna.</p></section>
    </main>
  );
}
