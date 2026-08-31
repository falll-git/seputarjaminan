"use client";

import {
  ArrowUpRight,
  ArrowsClockwise,
  ChatCircleDots,
  CheckCircle,
  FileText,
  MagnifyingGlass,
  Question,
  ShieldCheck,
  ShieldWarning,
} from "@phosphor-icons/react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { revealOnce } from "@/app/lib/public-motion";

const whatsappPreview = "Siang Pak/Bu, saya ingin mengetahui informasi lebih lanjut terkait aset [kode aset] — [judul aset].";

const steps = [
  {
    number: "01",
    label: "Temukan aset",
    title: "Pilih aset yang ingin diketahui.",
    description: "Gunakan pencarian, kategori, lokasi, atau BPRS penerbit untuk menemukan aset yang sesuai.",
    href: "/katalog",
    action: "Buka katalog",
    icon: MagnifyingGlass,
  },
  {
    number: "02",
    label: "Periksa informasi publik",
    title: "Baca detail sebelum bertanya.",
    description: "Perhatikan foto, lokasi, kondisi publik, spesifikasi, status, dan BPRS yang menerbitkan aset.",
    href: "/bprs",
    action: "Kenali BPRS penerbit",
    icon: FileText,
  },
  {
    number: "03",
    label: "Hubungi BPRS",
    title: "Lanjutkan melalui WhatsApp.",
    description: "Pada halaman aset, tombol WhatsApp membuka nomor marketing yang sudah dipilih BPRS beserta konteks asetnya.",
    action: "Tersedia di detail aset",
    icon: ChatCircleDots,
  },
] as const;

const askItems = [
  "Apakah aset masih tersedia?",
  "Berapa nilai atau harga terbarunya?",
  "Bagaimana jadwal melihat aset?",
];

const confirmItems = [
  "Kondisi fisik dan lokasi aset.",
  "Dokumen serta proses selanjutnya.",
  "Biaya lain yang mungkin berlaku.",
];

export default function InterestJourney() {
  const reducedMotion = useReducedMotion();

  return (
    <>
      <section className="site-frame interest-journey" aria-labelledby="interest-journey-title">
        <div className="interest-section-heading">
          <div>
            <p className="section-kicker">Alur yang perlu dilakukan</p>
            <h2 id="interest-journey-title">Tiga langkah, langsung ke sumbernya.</h2>
          </div>
          <p>Seputar Jaminan membantu Anda menemukan konteks awal. Informasi lanjutan tetap dikonfirmasi oleh BPRS penerbit.</p>
        </div>

        <ol className="interest-flow">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <motion.li className="interest-flow-step" key={step.number} {...revealOnce(reducedMotion, index * 0.07)}>
                <span className="interest-flow-index" aria-hidden="true">{step.number}</span>
                <span className="interest-flow-marker"><Icon aria-hidden="true" /></span>
                <div className="interest-flow-copy">
                  <p>{step.label}</p>
                  <h3>{step.title}</h3>
                  <span>{step.description}</span>
                </div>
                {"href" in step ? (
                  <Link className="interest-flow-action" href={step.href}>
                    <span>{step.action}</span>
                    <ArrowUpRight aria-hidden="true" />
                  </Link>
                ) : (
                  <span className="interest-flow-origin">
                    <CheckCircle weight="bold" aria-hidden="true" />
                    {step.action}
                  </span>
                )}
              </motion.li>
            );
          })}
        </ol>
      </section>

      <motion.section className="site-frame interest-conversation" aria-labelledby="interest-message-title" {...revealOnce(reducedMotion)}>
        <div className="interest-conversation-context">
          <p className="section-kicker">Preview percakapan</p>
          <h2 id="interest-message-title">Konteks aset sudah ikut di dalam pesan.</h2>
          <p>Pesan disiapkan setelah pengunjung menekan WhatsApp pada halaman aset. Isinya tetap dapat diubah sebelum dikirim.</p>
          <div className="interest-contact-rule">
            <ShieldCheck aria-hidden="true" />
            <span><strong>Nomor tujuan tidak ditampilkan di sini.</strong> Sistem mengarahkan pengunjung ke kontak marketing yang sudah dipilih dan diverifikasi BPRS.</span>
          </div>
        </div>

        <figure className="interest-message-preview">
          <div className="interest-message-meta">
            <span><ChatCircleDots aria-hidden="true" /> Pesan awal</span>
            <span>WhatsApp · siap diedit</span>
          </div>
          <blockquote>
            <span className="interest-message-sender">Anda</span>
            <p>“{whatsappPreview}”</p>
          </blockquote>
          <figcaption>
            <ArrowsClockwise aria-hidden="true" />
            Kode dan judul mengikuti aset yang sedang dibuka.
          </figcaption>
        </figure>
      </motion.section>

      <section className="site-frame interest-guidance" aria-labelledby="interest-guidance-title">
        <div className="interest-guidance-heading">
          <div>
            <p className="section-kicker">Sebelum melanjutkan</p>
            <h2 id="interest-guidance-title">Tanyakan yang penting. Konfirmasi kembali.</h2>
          </div>
          <p>Informasi pada katalog membantu penilaian awal, bukan menggantikan penjelasan resmi dari BPRS.</p>
        </div>

        <div className="interest-guidance-grid">
          <motion.article {...revealOnce(reducedMotion)}>
            <Question aria-hidden="true" />
            <p>Yang sebaiknya ditanyakan</p>
            <h3>Mulai dari kebutuhan praktis.</h3>
            <ul>{askItems.map((item) => <li key={item}>{item}</li>)}</ul>
          </motion.article>

          <motion.article {...revealOnce(reducedMotion, 0.07)}>
            <ArrowsClockwise aria-hidden="true" />
            <p>Yang harus dikonfirmasi ulang</p>
            <h3>Pastikan sebelum mengambil keputusan.</h3>
            <ul>{confirmItems.map((item) => <li key={item}>{item}</li>)}</ul>
          </motion.article>

          <motion.article className="interest-role-note" {...revealOnce(reducedMotion, 0.14)}>
            <ShieldWarning aria-hidden="true" />
            <p>Peran Seputar Jaminan</p>
            <h3>Katalog publik, bukan penentu transaksi.</h3>
            <p>Seputar Jaminan tidak menentukan harga, legalitas, kondisi akhir, atau keputusan transaksi. Seluruh kepastian diberikan langsung oleh BPRS penerbit.</p>
          </motion.article>
        </div>
      </section>
    </>
  );
}
