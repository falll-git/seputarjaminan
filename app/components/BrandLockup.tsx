import styles from "./BrandLockup.module.css";

export default function BrandLockup({ compact = false }: { compact?: boolean }) {
  return (
    <a className={`${styles.lockup}${compact ? ` ${styles.compact}` : ""}`} data-brand-lockup href="/" aria-label="Seputarjaminan by ruwang, kembali ke beranda">
      <span className={styles.name} aria-hidden="true"><span>seputar</span>{" "}<strong>jaminan</strong></span>
      <span className={styles.signature} aria-hidden="true">
        <span>by</span><span className={styles.parent}>ruwang</span>
      </span>
    </a>
  );
}
