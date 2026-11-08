import { ArrowRight, ArrowUpRight, MapPin } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import type { BprsProfile } from "@/app/data/catalog";
import BprsMark from "./BprsMark";
import DirectoryProvince from "./DirectoryProvince";
import PublicDataState from "./PublicDataState";
import { Button, SearchInput, TextLink } from "./ui";
import styles from "../bprs/bprs.module.css";

type Props = {
  profiles: BprsProfile[];
  initialQuery?: string;
  initialProvince?: string;
  currentCursor?: string;
  nextCursor?: string | null;
};
const SEARCH_THRESHOLD = 8;

function directoryUrl(query: string, province: string, cursor?: string | null) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (province) params.set("province", province);
  if (cursor) params.set("cursor", cursor);
  return params.size ? `/bprs?${params}` : "/bprs";
}

export default function BprsDirectory({ profiles, initialQuery = "", initialProvince = "", currentCursor = "", nextCursor }: Props) {
  const hasFilters = Boolean(initialQuery || initialProvince);
  const isSingleFeature = profiles.length === 1 && !hasFilters && !currentCursor && !nextCursor;
  const showSearch = hasFilters || Boolean(currentCursor || nextCursor) || profiles.length >= SEARCH_THRESHOLD;
  return <section aria-label="Hasil direktori BPRS" className={styles.directory}>
    {showSearch && <form className={styles.filters} action="/bprs" method="get" role="search" aria-label="Pencarian BPRS" key={`${initialQuery}/${initialProvince}/${currentCursor}`}>
      <SearchInput label="Cari BPRS atau wilayah" name="q" defaultValue={initialQuery} placeholder="Nama BPRS atau kota" maxLength={100} />
      <DirectoryProvince initialProvince={initialProvince} provinces={[...new Set(profiles.map(p=>p.province).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"id"))} />
      <Button type="submit">Tampilkan hasil <ArrowRight aria-hidden="true" /></Button>
      <p>Pencarian diterapkan setelah menekan Tampilkan hasil.</p>
    </form>}
    <div className={styles.resultBar}>
      <p><strong>{profiles.length}</strong> BPRS pada halaman ini</p>
      {(hasFilters || currentCursor) && <TextLink href="/bprs">Atur ulang</TextLink>}
    </div>
    {hasFilters && <p className={styles.applied}>Hasil untuk {initialQuery && <span>“{initialQuery}”</span>}{initialQuery && initialProvince && " · "}{initialProvince && <span>Provinsi kantor: {initialProvince}</span>}</p>}
    {profiles.length ? <ul className={`${styles.list} ${isSingleFeature ? styles.single : ""}`} data-bprs-list>
      {profiles.map(profile => <li key={profile.slug}>
        <Link className={styles.publisherLink} href={`/bprs/${profile.slug}`} prefetch={false} aria-label={`Buka profil ${profile.name}`}>
          <span className={styles.logo}><BprsMark profile={profile} /></span>
          <span className={styles.identity}>
            <strong>{profile.name}</strong>
            <span className={styles.location}><MapPin aria-hidden="true" />{profile.city}, {profile.province}</span>
            {isSingleFeature && <span className={styles.summary}>{profile.description}</span>}
          </span>
          {Number.isSafeInteger(profile.publishedAssetCount) && profile.publishedAssetCount >= 0 && <span className={styles.count}><strong>{profile.publishedAssetCount.toLocaleString("id-ID")}</strong> aset tersedia</span>}
          <span className={styles.action}>Lihat profil <ArrowUpRight aria-hidden="true" /></span>
        </Link>
      </li>)}
    </ul> : <PublicDataState kind={hasFilters ? "no-results" : "empty"} scene={hasFilters ? "search" : "directory"}
        title={hasFilters ? "Belum ada BPRS yang cocok." : currentCursor ? "Tidak ada BPRS pada halaman ini." : "Belum ada BPRS dengan aset tersedia."}
        message={hasFilters ? "Coba nama, kota, atau provinsi kantor yang lain." : "Anda tetap dapat menjelajahi katalog atau kembali nanti."}>
        {(hasFilters || currentCursor) ? <TextLink href="/bprs">Tampilkan semua BPRS</TextLink> : <TextLink href="/katalog">Buka katalog</TextLink>}
    </PublicDataState>}
    {(nextCursor || currentCursor) && <nav className={styles.pagination} aria-label="Halaman direktori">
      {currentCursor && <TextLink href={directoryUrl(initialQuery, initialProvince)}>Kembali ke halaman pertama</TextLink>}
      {nextCursor && <Link className="ui-button ui-button-secondary" href={directoryUrl(initialQuery, initialProvince, nextCursor)} prefetch={false}>Lihat BPRS berikutnya <ArrowRight aria-hidden="true" /></Link>}
    </nav>}
  </section>;
}
