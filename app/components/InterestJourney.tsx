import { ChatCircleDots, FileText, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import styles from "../cara-minat/help.module.css";

const steps = [
  { number: "01", title: "Cari aset", description: "Cari berdasarkan nama, jenis aset, lokasi, atau BPRS di katalog.", icon: MagnifyingGlass },
  { number: "02", title: "Baca detail", description: "Buka aset, lihat foto, lokasi, spesifikasi, dan nama BPRS penerbitnya.", icon: FileText },
  { number: "03", title: "Hubungi BPRS", description: "Tekan Hubungi BPRS pada detail aset. WhatsApp terbuka ke kontak yang ditentukan BPRS untuk aset tersebut.", icon: ChatCircleDots },
] as const;

export default function InterestJourney() {
  return <ol className={styles.steps} aria-label="Tiga langkah menghubungi BPRS">
    {steps.map(step => {
      const Icon = step.icon;
      return <li key={step.number}>
        <div className={styles.marker}><span>{step.number}</span><Icon aria-hidden="true" /></div>
        <h2>{step.title}</h2>
        <p>{step.description}</p>
        {step.number === "03" && <p className={styles.editNote}>Nama, kode, dan tautan aset ikut dalam pesan. Anda dapat mengeditnya sebelum mengirim.</p>}
      </li>;
    })}
  </ol>;
}
