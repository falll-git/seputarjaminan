import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import InterestJourney from "@/app/components/InterestJourney";
import SiteFooter from "@/app/components/SiteFooter";
import SiteHeader from "@/app/components/SiteHeader";
import { TextLink } from "@/app/components/ui";
import styles from "./help.module.css";

export const metadata: Metadata = {
  title: "Cara menghubungi | Seputar Jaminan by ruwang",
  description: "Tiga langkah sederhana untuk memeriksa aset dan menghubungi BPRS penerbit melalui WhatsApp.",
};

export default function CaraMinatPage() {
  return (
    <>
      <SiteHeader />
      <main className={`site-frame ${styles.page}`}>
        <header className={styles.heading}>
          <p>Panduan singkat · tanpa akun</p>
          <h1>Cara menghubungi</h1>
          <p>Dari menemukan aset sampai bertanya langsung kepada BPRS, cukup tiga langkah.</p>
        </header>

        <InterestJourney />

        <div className={styles.start}>
          <Link className="ui-button ui-button-primary" href="/katalog">Cari aset di katalog <ArrowRight aria-hidden="true" /></Link>
          <TextLink href="/bprs">Lihat daftar BPRS</TextLink>
        </div>
        <section className={styles.faq} aria-labelledby="help-questions">
          <h2 id="help-questions">Masih ada pertanyaan?</h2>
          <details><summary>Apakah menekan tombol langsung mengirim pesan?</summary><p>Tidak. Tombol hanya membuka WhatsApp dengan draf pesan. Periksa atau ubah pesannya, lalu kirim sendiri saat sudah siap.</p></details>
          <details><summary>Mengapa tombol kontak belum tersedia?</summary><p>Tautan kontak aset belum dapat digunakan. Coba muat ulang detail atau periksa kembali nanti. Jangan menggunakan nomor yang ditebak dari aset lain.</p></details>
        </section>
      </main>
      <SiteFooter compact />
    </>
  );
}
