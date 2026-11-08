import type { Metadata } from "next";
import BprsDirectory from "@/app/components/BprsDirectory";
import PublicDataState from "@/app/components/PublicDataState";
import SiteFooter from "@/app/components/SiteFooter";
import SiteHeader from "@/app/components/SiteHeader";
import { toBprsProfile } from "@/app/data/catalog";
import { listPublicInstitutions, publicDataStateKind } from "@/app/lib/public-api";
import { TextLink } from "@/app/components/ui";
import styles from "./bprs.module.css";
import { parsePublicPageQuery } from "../lib/public-page-query";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Daftar BPRS | Seputar Jaminan by ruwang",
  description: "BPRS dengan aset yang tersedia di katalog Seputar Jaminan. Kenali penerbit dan lihat asetnya.",
};

type BprsPageProps = {
  searchParams?: Promise<{ q?: string | string[]; province?: string | string[]; cursor?: string | string[] }>;
};

export default async function BprsPage({ searchParams }: BprsPageProps) {
  let params: Record<string, string> = {};
  let queryError: unknown;
  try { params = parsePublicPageQuery(searchParams ? await searchParams : {}, "directory"); }
  catch (error) { queryError = error; }
  const query = params.q ?? "", province = params.province ?? "", cursor = params.cursor ?? "";
  const result = await (queryError ? Promise.reject(queryError) : listPublicInstitutions({
    limit: 24,
    ...(query ? { q: query } : {}),
    ...(province ? { province } : {}),
    ...(cursor ? { cursor } : {}),
  })).then((value) => ({ ok: true as const, value })).catch((error: unknown) => ({ ok: false as const, error }));

  return (
    <>
      <SiteHeader />
      <main className={styles.page}>
        <header className={`site-frame ${styles.masthead}`}>
          <p className={styles.eyebrow}>Kenali penerbit aset</p>
          <h1>Daftar BPRS</h1>
          <p>BPRS dengan aset yang tersedia di katalog Seputarjaminan. Pilih BPRS untuk melihat profil dan asetnya.</p>
        </header>

        <div className="site-frame">
          {result.ok ? (
            <BprsDirectory
              key={`${query}/${province}/${cursor}`}
              profiles={result.value.items.map(toBprsProfile)}
              initialQuery={query}
              initialProvince={province}
              nextCursor={result.value.next_cursor}
              currentCursor={cursor}
            />
          ) : (
            <><PublicDataState
              kind={publicDataStateKind(result.error)}
              title={publicDataStateKind(result.error) === "invalid-query" ? "Pencarian atau halaman tidak valid." : publicDataStateKind(result.error) === "timeout" ? "Direktori BPRS memerlukan waktu lebih lama." : "Direktori BPRS belum dapat dimuat."}
              message={publicDataStateKind(result.error) === "invalid-query" ? "Kembali ke daftar BPRS untuk memulai pencarian baru." : "Silakan coba muat ulang atau kembali ke daftar BPRS."}
            /><TextLink href="/bprs">Kembali ke daftar BPRS</TextLink></>
          )}
        </div>
      </main>
      <SiteFooter compact />
    </>
  );
}
