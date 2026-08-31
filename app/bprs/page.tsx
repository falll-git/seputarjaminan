import type { Metadata } from "next";
import BprsDirectory from "@/app/components/BprsDirectory";
import PublicDataState from "@/app/components/PublicDataState";
import SiteFooter from "@/app/components/SiteFooter";
import SiteHeader from "@/app/components/SiteHeader";
import { toBprsProfile } from "@/app/data/catalog";
import { listPublicInstitutions, publicDataStateKind } from "@/app/lib/public-api";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "BPRS Penerbit | Seputar Jaminan by ruwang",
  description: "Direktori BPRS yang menerbitkan aset aktif pada Seputar Jaminan by ruwang.",
};

type BprsPageProps = {
  searchParams?: Promise<{ q?: string | string[]; province?: string | string[]; cursor?: string | string[] }>;
};

function firstValue(value?: string | string[]) {
  return (Array.isArray(value) ? value[0] ?? "" : value ?? "").trim();
}

export default async function BprsPage({ searchParams }: BprsPageProps) {
  const params = searchParams ? await searchParams : {};
  const query = firstValue(params.q).slice(0, 100);
  const province = firstValue(params.province).slice(0, 100);
  const cursor = firstValue(params.cursor).slice(0, 1_000);
  const result = await listPublicInstitutions({
    limit: 24,
    ...(query ? { q: query } : {}),
    ...(province ? { province } : {}),
    ...(cursor ? { cursor } : {}),
  }).then((value) => ({ ok: true as const, value })).catch((error: unknown) => ({ ok: false as const, error }));

  return (
    <>
      <SiteHeader />
      <main className="bprs-page">
        <header className="site-frame bprs-directory-masthead">
          <div>
            <p className="page-folio">Direktori / Penerbit</p>
            <h1>Direktori BPRS penerbit</h1>
          </div>
          <div className="bprs-directory-intro">
            <p>Kenali BPRS yang menerbitkan informasi aset pada Seputar Jaminan.</p>
            <p className="directory-disclosure">Hanya BPRS dengan profil dan aset aktif yang ditampilkan.</p>
          </div>
        </header>

        <div className="site-frame">
          {result.ok ? (
            <BprsDirectory
              profiles={result.value.items.map(toBprsProfile)}
              initialQuery={query}
              initialProvince={province}
              nextCursor={result.value.next_cursor}
            />
          ) : (
            <PublicDataState
              kind={publicDataStateKind(result.error)}
              title={publicDataStateKind(result.error) === "timeout" ? "Direktori BPRS memerlukan waktu lebih lama." : "Direktori BPRS belum dapat dimuat."}
              message={publicDataStateKind(result.error) === "timeout" ? "Permintaan dihentikan setelah melewati batas waktu aman. Coba muat ulang halaman." : "Silakan muat ulang halaman. Data contoh tidak digunakan sebagai pengganti."}
            />
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
