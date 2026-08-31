"use client";

import { ArrowRight, ArrowUpRight, Buildings, MapPin, MagnifyingGlass, X } from "@phosphor-icons/react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { BprsProfile } from "@/app/data/catalog";
import { revealOnce } from "@/app/lib/public-motion";
import BprsMark from "./BprsMark";

type BprsDirectoryProps = {
  profiles: BprsProfile[];
  initialQuery?: string;
  initialProvince?: string;
  nextCursor?: string | null;
};

const SEARCH_THRESHOLD = 8;

function directoryUrl(query: string, province: string, cursor?: string | null) {
  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query.trim());
  if (province.trim()) params.set("province", province.trim());
  if (cursor) params.set("cursor", cursor);
  return params.size ? `/bprs?${params.toString()}` : "/bprs";
}

export default function BprsDirectory({
  profiles,
  initialQuery = "",
  initialProvince = "",
  nextCursor,
}: BprsDirectoryProps) {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const [query, setQuery] = useState(initialQuery);
  const [province, setProvince] = useState(initialProvince);
  const hasFilters = Boolean(initialQuery || initialProvince);
  const isSingleFeature = profiles.length === 1 && !hasFilters && !nextCursor;
  const showSearch = hasFilters || Boolean(nextCursor) || profiles.length >= SEARCH_THRESHOLD;

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push(directoryUrl(query, province));
  }

  function clearFilters() {
    setQuery("");
    setProvince("");
    router.push("/bprs");
  }

  return (
    <section className={`bprs-directory${isSingleFeature ? " is-single" : " is-index"}`} aria-labelledby="bprs-directory-title">
      <div className="bprs-directory-heading">
        <div>
          <p className="section-kicker">Penerbit aktif</p>
          <h2 id="bprs-directory-title">Daftar BPRS</h2>
        </div>
        <p className="bprs-directory-count" aria-live="polite">
          <strong>{String(profiles.length).padStart(2, "0")}</strong>
          <span>BPRS pada halaman ini</span>
        </p>
      </div>

      {showSearch && (
        <form className="bprs-directory-filters" role="search" onSubmit={submit}>
          <label className="bprs-search-field">
            <span>Cari BPRS atau wilayah</span>
            <span className="bprs-search-control">
              <MagnifyingGlass aria-hidden="true" />
              <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nama BPRS atau kota" autoComplete="off" />
            </span>
          </label>

          <label className="bprs-province-field">
            <span>Provinsi kantor</span>
            <input type="text" value={province} onChange={(event) => setProvince(event.target.value)} placeholder="Contoh: Jawa Barat" autoComplete="address-level1" />
          </label>

          <button className="bprs-filter-submit" type="submit">
            <span>Tampilkan hasil</span>
            <ArrowRight aria-hidden="true" />
          </button>

          {hasFilters && (
            <button className="bprs-clear-filter" type="button" onClick={clearFilters}>
              <X aria-hidden="true" />
              <span>Atur ulang</span>
            </button>
          )}
        </form>
      )}

      {isSingleFeature ? (
        <motion.article
          className="bprs-publisher-feature"
          {...revealOnce(reducedMotion)}
        >
          <Link href={`/bprs/${profiles[0].slug}`} aria-label={`Buka profil ${profiles[0].name}`}>
            <span className="bprs-feature-folio" aria-hidden="true">01</span>
            <BprsMark profile={profiles[0]} />
            <span className="bprs-feature-identity">
              <small>Satu penerbit terhubung</small>
              <strong>{profiles[0].name}</strong>
              <span><MapPin aria-hidden="true" /> {profiles[0].city}, {profiles[0].province}</span>
              <em>{profiles[0].description}</em>
            </span>
            <span className="bprs-feature-stat">
              <strong>{String(profiles[0].publishedAssetCount).padStart(2, "0")}</strong>
              <span>aset aktif</span>
            </span>
            <span className="bprs-profile-action">Lihat profil <ArrowUpRight aria-hidden="true" /></span>
          </Link>
        </motion.article>
      ) : profiles.length ? (
        <>
          <ol className="bprs-index-list">
            {profiles.map((profile, index) => (
              <motion.li
                className="bprs-index-row"
                key={profile.slug}
                {...revealOnce(reducedMotion, Math.min(index, 5) * 0.045)}
              >
                <Link href={`/bprs/${profile.slug}`} aria-label={`Buka profil ${profile.name}, ${profile.publishedAssetCount} aset aktif`}>
                  <span className="bprs-index-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                  <BprsMark profile={profile} />
                  <span className="bprs-index-identity">
                    <strong>{profile.name}</strong>
                    <span><MapPin aria-hidden="true" /> {profile.city}, {profile.province}</span>
                  </span>
                  <span className="bprs-index-stats">
                    <strong>{String(profile.publishedAssetCount).padStart(2, "0")}</strong>
                    <span>aset aktif</span>
                  </span>
                  <span className="bprs-profile-action">Lihat profil <ArrowUpRight aria-hidden="true" /></span>
                </Link>
              </motion.li>
            ))}
          </ol>

          {nextCursor && (
            <Link className="directory-next-page" href={directoryUrl(initialQuery, initialProvince, nextCursor)}>
              <span>Lihat BPRS berikutnya</span>
              <ArrowRight aria-hidden="true" />
            </Link>
          )}
        </>
      ) : (
        <div className="bprs-empty-state">
          <Buildings aria-hidden="true" />
          <div>
            <p className="section-kicker">{hasFilters ? "Tidak ada hasil" : "Direktori belum tersedia"}</p>
            <h3>{hasFilters ? "Belum ada BPRS yang cocok." : "Belum ada BPRS penerbit aktif."}</h3>
            <p>{hasFilters ? "Periksa kembali nama atau provinsi yang dimasukkan." : "BPRS akan muncul setelah profil dan aset aktif diterbitkan melalui ruwang."}</p>
            {hasFilters && <button type="button" onClick={clearFilters}>Tampilkan semua BPRS</button>}
          </div>
        </div>
      )}
    </section>
  );
}
