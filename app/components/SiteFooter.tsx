import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import BrandLockup from "./BrandLockup";

const links = [
  { href: "/katalog", label: "Katalog" },
  { href: "/bprs", label: "BPRS penerbit" },
  { href: "/cara-minat", label: "Cara minat" },
];

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-frame footer-identity-line" aria-label="Hubungan produk">
        <span>Seputar Jaminan</span>
        <i aria-hidden="true" />
        <span>Layanan publik ruwang</span>
      </div>
      <div className="site-frame footer-grid">
        <div className="footer-brand">
          <BrandLockup inverted />
          <p><strong>Layanan katalog publik</strong><span>dari ruwang.</span></p>
        </div>
        <nav className="footer-nav" aria-label="Navigasi footer">
          {links.map((item, index) => (
            <a href={item.href} key={item.href}>
              <small>0{index + 1}</small>
              <span>{item.label}</span>
              <ArrowUpRight aria-hidden="true" />
            </a>
          ))}
        </nav>
        <div className="footer-note" aria-labelledby="footer-publisher-heading">
          <strong id="footer-publisher-heading">Informasi diterbitkan oleh masing-masing BPRS.</strong>
          <p>Harga, dokumen, kondisi, dan ketersediaan terbaru dikonfirmasi langsung melalui kontak BPRS pada setiap aset.</p>
        </div>
      </div>
      <div className="site-frame footer-base">
        <span>© {new Date().getFullYear()} Seputar Jaminan by ruwang</span>
        <span>Katalog publik · tanpa akun</span>
      </div>
    </footer>
  );
}
