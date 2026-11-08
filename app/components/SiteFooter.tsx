import BrandLockup from "./BrandLockup";
import { publicNavigation as links } from "../lib/public-navigation";
import styles from "./SiteFooter.module.css";

// Keep the legacy compact prop compatible; every public route now uses one quiet footer.
export default function SiteFooter(_props: { compact?: boolean }) {
  return (
    <footer className={`site-footer ${styles.footer}`}>
      <div className={`site-frame ${styles.inner}`}>
        <BrandLockup compact />
        <nav className={styles.navigation} aria-label="Navigasi footer">
          {links.map(item => <a href={item.href} key={item.href}>{item.label}</a>)}
        </nav>
        <p className={styles.copyright}>© {new Date().getFullYear()} Seputarjaminan</p>
        <p className={styles.note}>Informasi lanjutan melalui BPRS pada detail aset.</p>
      </div>
    </footer>
  );
}
