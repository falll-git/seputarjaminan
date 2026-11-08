import styles from "./HomeFaq.module.css";

const questions = [
  ["Apa itu Seputarjaminan?", "Seputarjaminan adalah katalog publik agunan dari BPRS. Anda dapat melihat aset dan membaca informasi dasarnya, lalu menanyakan informasi lanjutan kepada BPRS terkait."],
  ["Apakah saya perlu membuat akun?", "Tidak. Anda dapat melihat katalog, membaca detail aset, dan membuka kontak WhatsApp yang tersedia tanpa membuat akun."],
  ["Bagaimana menemukan aset yang sesuai?", "Gunakan pencarian atau pilih jenis aset. Di katalog, Anda juga dapat menyaring berdasarkan provinsi aset dan BPRS, lalu menekan Tampilkan hasil."],
  ["Di mana saya bisa menanyakan harga, jadwal, dan kondisi terbaru?", "Buka detail aset, lalu gunakan tombol Hubungi BPRS untuk bertanya melalui WhatsApp. Informasi lanjutan dikonfirmasi langsung dengan BPRS terkait."],
  ["Siapa yang menerima pesan WhatsApp saya?", "Pesan ditujukan kepada kontak yang ditentukan BPRS untuk publikasi tersebut. Nama BPRS tujuan ditampilkan di dekat tombol kontak pada detail aset."],
  ["Apakah tombol WhatsApp langsung mengirim pesan?", "Tidak. Tombol hanya membuka WhatsApp dengan draf pesan. Anda dapat memeriksa dan mengubahnya sebelum mengirim sendiri."],
] as const;

export default function HomeFaq() {
  return <section className={`site-frame ${styles.faq}`} aria-labelledby="home-faq-title" data-home-section="faq">
    <div className={styles.heading}><p>Sebelum mulai</p><h2 id="home-faq-title">Yang sering<br /> ditanyakan</h2><span>Hal penting untuk menjelajahi katalog dan menghubungi BPRS.</span></div>
    <div className={styles.questions}>{questions.map(([question, answer]) => <details key={question} name="home-faq">
      <summary>{question}<span className={styles.toggle} aria-hidden="true" /></summary>
      <div className={styles.answer}><p>{answer}</p></div>
    </details>)}</div>
  </section>;
}
