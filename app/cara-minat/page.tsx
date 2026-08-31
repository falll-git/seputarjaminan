import { ArrowRight, Eye, ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import InterestJourney from "@/app/components/InterestJourney";
import SiteFooter from "@/app/components/SiteFooter";
import SiteHeader from "@/app/components/SiteHeader";

export const metadata: Metadata = {
  title: "Cara Menyampaikan Minat | Seputar Jaminan by ruwang",
  description: "Tiga langkah sederhana untuk memeriksa aset dan menghubungi BPRS penerbit melalui WhatsApp.",
};

export default function CaraMinatPage() {
  return (
    <>
      <SiteHeader />
      <main className="interest-page">
        <header className="site-frame interest-masthead">
          <div>
            <p className="page-folio">Panduan / Cara minat</p>
            <h1>Tertarik pada aset? Mulai dari sini.</h1>
          </div>
          <div className="interest-masthead-intro">
            <p>Temukan aset, periksa informasi publiknya, lalu hubungi BPRS penerbit melalui tombol WhatsApp pada halaman aset.</p>
            <div className="interest-trust-row">
              <span><Eye aria-hidden="true" /> Tanpa akun</span>
              <span><ShieldCheck aria-hidden="true" /> Kontak dipilih BPRS</span>
            </div>
            <Link className="interest-primary-link" href="/katalog">
              <span>Jelajahi katalog</span>
              <ArrowRight aria-hidden="true" />
            </Link>
          </div>
        </header>

        <InterestJourney />

        <section className="site-frame interest-closing" aria-label="Mulai dari katalog aset">
          <ShieldCheck aria-hidden="true" />
          <div>
            <p>Mulai dengan aman</p>
            <h2>Pilih asetnya. BPRS akan menjawab pertanyaannya.</h2>
            <span>Tombol WhatsApp tersedia pada setiap halaman detail aset yang aktif.</span>
          </div>
          <Link href="/katalog">
            <span>Buka katalog</span>
            <ArrowRight aria-hidden="true" />
          </Link>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
