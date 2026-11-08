"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { ArrowRight, Car, Factory, FadersHorizontal, House, MapTrifold, SquaresFour, X } from "@phosphor-icons/react";
import { Radio, RadioGroup } from "react-aria-components";
import { UNSAFE_PortalProvider } from "react-aria";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLayoutEffect, useRef, useState, useTransition } from "react";
import type { Asset, BprsProfile, Category } from "../data/catalog";
import { Button, FilterChip, IconButton, SearchInput } from "./ui";
import ControlSelect from "./ControlSelect";
import CatalogCombobox, { type CatalogFilterOption } from "./CatalogCombobox";
import AssetCard from "./AssetCard";
import PublicDataState, { type PublicDataStateKind } from "./PublicDataState";
import { restoreCatalogPosition, safeCatalogReturn } from "../lib/catalog-navigation";
import styles from "../katalog/catalog.module.css";
import { usePublisherOptions } from "../lib/use-publisher-options";

type FilterKey = "q" | "category" | "bprs" | "province" | "sort";
type Draft = { category: string; bprs: string; bprsInput: string; province: string };
type Props = {
  items: Asset[]; categories: Category[]; publishers: BprsProfile[]; provinces: string[];
  nextCursor?: string | null; errorKind?: PublicDataStateKind;
  publisherCursor?: string | null;
  taxonomyUnavailable?: boolean; publishersUnavailable?: boolean;
};
type FilterFormProps = Pick<Props, "categories" | "publishers" | "provinces" | "taxonomyUnavailable" | "publishersUnavailable" | "publisherCursor"> & {
  applied: Draft; onApply: (draft: Draft) => void; mode: "desktop" | "mobile"; pending: boolean;
};

/** Both layouts use the same draft/commit semantics. Typing never changes applied filters. */
function FilterForm({ categories, publishers, publisherCursor, provinces, taxonomyUnavailable, publishersUnavailable, applied, onApply, mode, pending }: FilterFormProps) {
  const [draft, setDraft] = useState(applied);
  const [selectedPublisher, setSelectedPublisher] = useState<CatalogFilterOption | undefined>(() => {
    const publisher = publishers.find(p => p.slug === applied.bprs);
    return publisher ? {id:publisher.slug,label:publisher.name,supporting:[publisher.city,publisher.province].filter(Boolean).join(", "),markUrl:publisher.markUrl} : undefined;
  });
  const options = usePublisherOptions(publishers, publisherCursor, publishersUnavailable);
  const categoryIcons = { tanah: MapTrifold, bangunan: House, "mesin-peralatan": Factory, kendaraan: Car };
  const publisherOptions: CatalogFilterOption[] = [
    { id: "all", label: "Semua BPRS" },
    ...options.items.map(p => ({id:p.slug, label:p.name, supporting:[p.city,p.province].filter(Boolean).join(", "), markUrl:p.markUrl})),
  ];
  // Preserve a real selected identity when another async search replaces the option page.
  if (selectedPublisher && !publisherOptions.some(p=>p.id===selectedPublisher.id)) publisherOptions.push(selectedPublisher);
  const validPublisher = draft.bprsInput === "" || publisherOptions.some(p=>p.id===draft.bprs && p.label===draft.bprsInput);
  const changed = draft.category !== applied.category || draft.bprs !== applied.bprs || draft.province.trim() !== applied.province;
  function reset() { setDraft({category:"all",bprs:"all",bprsInput:"",province:""}); options.search(""); }
  return <form className={styles.filterForm} data-mode={mode} onSubmit={event=>{event.preventDefault(); if(validPublisher) onApply(draft);}}>
    <div className={styles.filterFields}>
      <RadioGroup className={styles.categoryPicker} aria-label="Jenis aset" value={draft.category} onChange={category=>setDraft({...draft,category})}>
        <span className={styles.fieldLabel}>Jenis aset</span>
        <div className={styles.categoryOptions}>
          <Radio value="all" className={styles.categoryAll}><SquaresFour aria-hidden="true"/><span>Semua jenis aset</span></Radio>
          {categories.map(c=>{const Icon=categoryIcons[c.slug] ?? SquaresFour; return <Radio key={c.slug} value={c.slug} className={styles.categoryOption}><Icon aria-hidden="true"/><span>{c.label}</span></Radio>;})}
        </div>
        {draft.category !== "all" && !categories.some(c=>c.slug===draft.category) && <Radio value={draft.category} className={styles.categoryAll}>{draft.category}</Radio>}
      </RadioGroup>
      {taxonomyUnavailable && <p className={styles.filterHint}>Pilihan jenis aset belum dapat dimuat.</p>}
      <div className={styles.pickerRow}>
      <CatalogCombobox label="Provinsi aset" placeholder="Cari provinsi" emptyMessage="Tidak ada saran. Anda tetap dapat memakai provinsi yang diketik." allowsCustomValue
        description="Saran dari aset pada halaman ini. Provinsi lain bisa diketik."
        options={provinces.map(p=>({id:p,label:p}))} selectedKey={provinces.includes(draft.province)?draft.province:null} inputValue={draft.province}
        onClear={()=>setDraft(current=>({...current,province:""}))}
        onInputChange={province=>setDraft(current=>({...current,province}))} onSelectionChange={province=>setDraft(current=>({...current,province}))}/>
      <CatalogCombobox label="BPRS penerbit" placeholder="Cari nama BPRS" emptyMessage={options.loading ? "Mencari BPRS…" : options.error ? "Pilihan BPRS gagal dimuat." : "BPRS tidak ditemukan."}
        options={publisherOptions} selectedKey={draft.bprs === "all" ? null : draft.bprs || null} inputValue={draft.bprsInput}
        description="Cari nama atau lokasi BPRS. Pilih dari hasil pencarian."
        loading={options.loading} failed={Boolean(options.error)} status={options.loading ? "Mencari BPRS…" : options.error ? "Pilihan BPRS gagal dimuat. Filter lain tetap dapat dipakai." : undefined}
        onLoadMore={options.cursor || options.error ? options.loadMore : undefined}
        moreLabel={options.error ? "Coba muat pilihan BPRS" : "Muat pilihan BPRS berikutnya"}
        onClear={()=>{setDraft(current=>({...current,bprs:"all",bprsInput:""})); options.search("");}}
        onInputChange={value=>{setDraft(current=>({...current,bprsInput:value,...(!value ? {bprs:"all"} : {})})); if(value !== publisherOptions.find(p=>p.id===draft.bprs)?.label) options.search(value);}}
        onSelectionChange={key=>{const selected=publisherOptions.find(p=>p.id===key); setSelectedPublisher(selected); setDraft(current=>({...current,bprs:key,bprsInput:key==="all"?"":selected?.label ?? ""}));}}/>
      </div>
      {!validPublisher && <p role="status" className={styles.filterHint}>Pilih BPRS dari daftar atau kosongkan kolom.</p>}
      <p role="status" className={styles.filterHint} data-changed={changed || undefined}>{changed ? "Pilihan belum diterapkan. Tekan Tampilkan hasil." : "Pilih filter, lalu tekan Tampilkan hasil."}</p>
    </div>
    <div className={styles.filterActions}>
      <Button variant="secondary" onClick={reset} disabled={pending}>Atur ulang</Button>
      <Button type="submit" disabled={!validPublisher || pending}>Tampilkan hasil</Button>
    </div>
  </form>;
}

function CatalogSearch({ query, onSubmit, pending }: { query:string; onSubmit:(value:string)=>void; pending:boolean }) {
  const [value,setValue]=useState(query);
  return <form className={`${styles.search} sj-search-bar`} role="search" onSubmit={e=>{e.preventDefault();onSubmit(value.trim());}}>
    <SearchInput label="Cari aset" clearLabel="Hapus pencarian" hideLabel value={value} maxLength={100} disabled={pending} onChange={e=>setValue(e.target.value)} onClear={()=>{setValue("");onSubmit("");}} placeholder="Cari aset atau lokasi" />
    <Button type="submit" disabled={pending}>Cari aset<ArrowRight aria-hidden="true"/></Button>
  </form>;
}

export default function CatalogClient({items,categories,publishers,publisherCursor,provinces,nextCursor,errorKind,taxonomyUnavailable,publishersUnavailable}: Props) {
  const params=useSearchParams(), pathname=usePathname(), router=useRouter();
  const [pending,startTransition]=useTransition();
  const [filterOpen,setFilterOpen]=useState(false);
  const filterPanelRef=useRef<HTMLDivElement>(null);
  const q=(params.get("q") ?? "").slice(0,100);
  const category=params.get("category") ?? "all", bprs=params.get("bprs") ?? "all";
  const province=(params.get("province") ?? "").slice(0,100), sort=params.get("sort")==="terlama" ? "terlama" : "terbaru";
  const publisherName=publishers.find(p=>p.slug===bprs)?.name ?? (bprs==="all" ? "" : bprs);
  const applied:Draft={category,bprs,bprsInput:publisherName,province};
  const catalogUrl=safeCatalogReturn(`${pathname}?${params}`);
  useLayoutEffect(()=>{restoreCatalogPosition(catalogUrl);},[catalogUrl,items]);
  function routeWith(changes:Partial<Record<FilterKey,string>>,cursor?:string|null) {
    const next=new URLSearchParams(params.toString()); next.delete("cursor");
    for(const [key,value] of Object.entries(changes)) {
      if(!value||value==="all"||(key==="sort"&&value==="terbaru")) next.delete(key); else next.set(key,value);
    }
    if(cursor) next.set("cursor",cursor);
    return safeCatalogReturn(`${pathname}?${next}`);
  }
  function navigate(url:string) { startTransition(()=>router.push(url,{scroll:false})); }
  function apply(draft:Draft) {
    navigate(routeWith({category:draft.category,bprs:draft.bprs,province:draft.province.trim()})); setFilterOpen(false);
  }
  const filterProps={categories,publishers,publisherCursor,provinces,applied,onApply:apply,pending,taxonomyUnavailable,publishersUnavailable};
  const chips: {key:FilterKey;label:string}[]=[
    ...(q ? [{key:"q" as const,label:`Pencarian: ${q}`}] : []),
    ...(category!=="all" ? [{key:"category" as const,label:`Jenis: ${categories.find(c=>c.slug===category)?.label ?? category}`}] : []),
    ...(province ? [{key:"province" as const,label:`Provinsi: ${province}`}] : []),
    ...(bprs!=="all" ? [{key:"bprs" as const,label:`BPRS: ${publisherName}`}] : []),
  ];
  const activeFilters=chips.filter(c=>c.key!=="q").length;
  const hasCriteria=chips.length>0;
  return <section className={`site-frame ${styles.shell}`} aria-label="Pencarian dan hasil katalog" aria-busy={pending}>
    <div className={styles.toolbar}>
      <CatalogSearch key={q} query={q} onSubmit={value=>navigate(routeWith({q:value}))} pending={pending}/>
      <div className={styles.toolbarActions}>
        <Dialog.Root open={filterOpen} onOpenChange={setFilterOpen}>
          <Dialog.Trigger asChild><Button className={styles.mobileTrigger} variant="secondary"><FadersHorizontal aria-hidden="true"/>Filter{activeFilters ? ` · ${activeFilters}` : ""}</Button></Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className={styles.overlay}/>
            <Dialog.Content ref={filterPanelRef} className={styles.sheet} aria-describedby="catalog-filter-help" onEscapeKeyDown={event=>{
              // A nested picker owns the first Escape; the next closes the filter sheet.
              if (filterPanelRef.current?.querySelector('[role="listbox"]')) event.preventDefault();
            }}>
              <div className={styles.sheetHead}><Dialog.Title>Filter katalog</Dialog.Title><Dialog.Close asChild><IconButton label="Tutup filter"><X aria-hidden="true"/></IconButton></Dialog.Close></div>
              <Dialog.Description id="catalog-filter-help" className={styles.sheetDescription}>Atur ulang hanya mengubah pilihan sementara. Tutup panel untuk membatalkan.</Dialog.Description>
              <UNSAFE_PortalProvider getContainer={()=>filterPanelRef.current}>
                <FilterForm {...filterProps} mode="mobile"/>
              </UNSAFE_PortalProvider>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
        <ControlSelect label="Urutkan" value={sort} disabled={pending} onChange={sort=>navigate(routeWith({sort}))} options={[{id:"terbaru",label:"Terbaru"},{id:"terlama",label:"Terlama"}]}/>
      </div>
    </div>
    <aside className={styles.rail} aria-label="Filter katalog"><FilterForm key={catalogUrl} {...filterProps} mode="desktop"/></aside>
    {chips.length>0 && <div className={styles.chips} aria-label="Filter aktif">
      {chips.map(chip=><FilterChip key={chip.key} active disabled={pending} aria-label={`Hapus ${chip.label}`} onClick={()=>navigate(routeWith({[chip.key]:""}))}>{chip.label}<X aria-hidden="true"/></FilterChip>)}
      <Button variant="text" disabled={pending} onClick={()=>navigate("/katalog")}>Hapus semua</Button>
    </div>}
    <div className={styles.body}>
      <div className={styles.results}>
        <p className={styles.count} role="status">{pending ? "Memuat hasil…" : errorKind ? "Jumlah aset belum tersedia." : `${items.length} aset ditampilkan pada halaman ini`}</p>
        {errorKind ? <><PublicDataState compact kind={errorKind} title={errorKind==="invalid-query" ? "Pencarian atau halaman tidak valid." : errorKind==="timeout"?"Katalog memerlukan waktu lebih lama.":"Katalog belum dapat dimuat."} message={errorKind==="invalid-query" ? "Atur ulang pencarian. Tautan halaman mungkin tidak sesuai dengan filter aktif." : "Coba muat ulang. Pencarian dan filter Anda tetap tersimpan."}/>{errorKind==="invalid-query" && <Button variant="secondary" onClick={()=>navigate("/katalog")}>Atur ulang pencarian</Button>}</> : items.length>0 ? <>
          <div className={styles.grid}>{items.map(asset=><AssetCard asset={asset} catalogReturn={catalogUrl} key={asset.id}/>)}</div>
          {nextCursor && <Link className={styles.next} href={routeWith({},nextCursor)} prefetch={false}>Lihat aset berikutnya<ArrowRight aria-hidden="true"/></Link>}
          {params.get("cursor") && <Link className={styles.next} href={routeWith({})} prefetch={false}>Kembali ke halaman pertama</Link>}
        </> : <PublicDataState kind={hasCriteria ? "no-results" : "empty"}
          title={params.get("cursor") ? "Halaman ini tidak berisi aset." : hasCriteria ? "Tidak ada hasil pencarian." : "Belum ada aset yang diterbitkan."}
          message={hasCriteria ? "Coba kata yang lebih umum atau hapus sebagian filter." : "Silakan kembali lagi untuk melihat aset yang tersedia."}>
          {hasCriteria && <Button variant="secondary" onClick={()=>navigate("/katalog")}>Atur ulang pencarian</Button>}
          {params.get("cursor") && <Link className={styles.next} href={routeWith({})} prefetch={false}>Kembali ke halaman pertama</Link>}
        </PublicDataState>}
      </div>
    </div>
  </section>;
}
