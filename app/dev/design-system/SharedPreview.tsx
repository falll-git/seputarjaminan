"use client";

import { useState } from "react";
import { ArrowRight, X } from "@phosphor-icons/react";
import { Button, CardSurface, Divider, FilterChip, IconButton, SearchInput, SectionHeading, TextLink } from "../../components/ui";
import ControlSelect from "../../components/ControlSelect";
import CatalogCombobox from "../../components/CatalogCombobox";
import AssetCard from "../../components/AssetCard";
import AssetShowcaseCard from "../../components/AssetShowcaseCard";
import type { Asset } from "../../data/catalog";

// These specimens are imported exclusively by a development-gated route.
const specimen: Asset = {
  id: "DEV-PREVIEW", slug: "dev-preview", title: "Contoh judul panjang: rumah tinggal dengan halaman luas di kawasan permukiman dan akses jalan lingkungan",
  categoryCode: "BANGUNAN", category: "bangunan", categoryLabel: "Bangunan", subtypeCode: "RUMAH", subtype: "Rumah",
  city: "Kota contoh", province: "Provinsi contoh", status: "Tersedia", photoCount: 0, updatedAt: "2026-09-14",
  publisher: { slug: "dev-preview", name: "Contoh identitas BPRS dengan nama yang sangat panjang untuk pengujian tata letak", markUrl: "" },
  cover: { url: "", altText: "", width: 1200, height: 900 },
};

export default function SharedPreview() {
  const [chip, setChip] = useState(false);
  const [query, setQuery] = useState("");
  const [selection, setSelection] = useState("all");
  const [sort, setSort] = useState("newest");
  return <section className="shared-preview" aria-labelledby="shared-heading">
    <SectionHeading id="shared-heading" eyebrow="Tahap 3 · specimen developer">Komponen bersama dan keluarga kartu</SectionHeading>
    <p>Contoh sintetis untuk inspeksi, bukan publikasi BPRS. Tautan kartu tidak menuju aset nyata.</p>
    <div className="shared-preview-actions">
      <Button>Aksi utama<ArrowRight aria-hidden="true" /></Button><Button variant="secondary">Aksi kedua</Button>
      <Button disabled>Nonaktif</Button><Button variant="secondary" disabled>Kedua nonaktif</Button><Button variant="text">Aksi teks</Button>
      <TextLink href="#shared-heading">Tautan teks</TextLink><IconButton label="Contoh tutup"><X aria-hidden="true" /></IconButton>
      <IconButton label="Contoh nonaktif" disabled><X aria-hidden="true" /></IconButton>
      <FilterChip active={chip} onClick={() => setChip(!chip)}>Bangunan</FilterChip><FilterChip disabled>Filter nonaktif</FilterChip>
    </div>
    <div className="shared-preview-grid">
      <SearchInput label="Pencarian komponen" placeholder="Jenis aset atau lokasi" />
      <ControlSelect label="Pilihan komponen" value={sort} onChange={setSort} options={[{id:"newest",label:"Terbaru"},{id:"oldest",label:"Terlama"}]} />
      <CatalogCombobox label="Pilihan yang dapat dicari" placeholder="Cari pilihan" emptyMessage="Pilihan tidak ditemukan."
        options={[{ id: "all", label: "Semua pilihan" }, { id: "building", label: "Bangunan" }]} selectedKey={selection}
        inputValue={query} onInputChange={setQuery} onSelectionChange={setSelection} />
      <CardSurface><div className="shared-preview-inset">Permukaan untuk konten yang perlu dikelompokkan. Bukan pembungkus wajib setiap bagian.</div></CardSurface>
    </div>
    <Divider />
    <div className="shared-preview-grid">
      <AssetCard asset={specimen} />
      <AssetShowcaseCard asset={{ ...specimen, title: "Contoh pajangan beranda", id: "DEV-SHOWCASE" }} specs={[{ label: "Luas tanah", value: "126 m²" }, { label: "Luas bangunan", value: "148 m²" }]} />
    </div>
  </section>;
}
