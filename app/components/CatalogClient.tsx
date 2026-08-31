"use client";

import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowCounterClockwise,
  ArrowRight,
  CaretDown,
  Check,
  FadersHorizontal,
  MagnifyingGlass,
  X,
} from "@phosphor-icons/react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import type { Asset, BprsProfile, Category } from "../data/catalog";
import { pressFeedback, PUBLIC_MOTION_DURATION, PUBLIC_MOTION_EASE } from "../lib/public-motion";
import AssetCard from "./AssetCard";
import CatalogCombobox, { type CatalogFilterOption } from "./CatalogCombobox";

type FilterKey = "q" | "category" | "bprs" | "province" | "sort";

type CatalogClientProps = {
  items: Asset[];
  categories: Category[];
  publishers: BprsProfile[];
  provinces: string[];
  nextCursor?: string | null;
};

type FilterValues = {
  category: string;
  bprs: string;
  bprsInput: string;
  province: string;
  provinceKey: string | null;
};

type FilterPanelProps = {
  mode: "desktop" | "mobile";
  categories: Category[];
  publisherOptions: CatalogFilterOption[];
  provinceOptions: CatalogFilterOption[];
  values: FilterValues;
  activeFilters: number;
  onCategoryChange: (value: string) => void;
  onBprsInputChange: (value: string) => void;
  onBprsChange: (value: string) => void;
  onProvinceInputChange: (value: string) => void;
  onProvinceChange: (value: string) => void;
  onReset: () => void;
};

type CatalogSearchProps = {
  query: string;
  onSubmit: (value: string) => void;
  onClear: () => void;
};

type DesktopFilterPanelProps = {
  categories: Category[];
  publisherOptions: CatalogFilterOption[];
  provinceOptions: CatalogFilterOption[];
  category: string;
  bprs: string;
  publisherName: string;
  province: string;
  provinceKey: string | null;
  activeFilters: number;
  onCategoryChange: (value: string) => void;
  onBprsChange: (value: string) => void;
  onProvinceChange: (value: string) => void;
  onReset: () => void;
};

function FilterSelectionMark({ visible }: { visible: boolean }) {
  const reducedMotion = useReducedMotion();

  return (
    <AnimatePresence initial={false}>
      {visible ? (
        <motion.span
          className="filter-selection-mark"
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.72 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.82 }}
          transition={{ duration: PUBLIC_MOTION_DURATION.fast, ease: PUBLIC_MOTION_EASE }}
        >
          <Check weight="bold" aria-hidden="true" />
        </motion.span>
      ) : null}
    </AnimatePresence>
  );
}

function FilterPanel({
  mode,
  categories,
  publisherOptions,
  provinceOptions,
  values,
  activeFilters,
  onCategoryChange,
  onBprsInputChange,
  onBprsChange,
  onProvinceInputChange,
  onProvinceChange,
  onReset,
}: FilterPanelProps) {
  const reducedMotion = useReducedMotion();

  function selectPublisher(key: string) {
    const option = publisherOptions.find((item) => item.id === key);
    onBprsInputChange(key === "all" ? "" : option?.label ?? "");
    onBprsChange(key);
  }

  function selectProvince(key: string) {
    const option = provinceOptions.find((item) => item.id === key);
    const next = key === "all" ? "" : option?.label ?? "";
    onProvinceInputChange(next);
    onProvinceChange(next);
  }

  return (
    <div className="catalog-filter-groups" data-mode={mode}>
      <fieldset className="filter-group category-filter">
        <legend>Kategori</legend>
        <motion.button className={values.category === "all" ? "is-active" : ""} onClick={() => onCategoryChange("all")} type="button" layout="position" {...pressFeedback(reducedMotion)}>
          <span>00</span><strong>Semua aset</strong><FilterSelectionMark visible={values.category === "all"} />
        </motion.button>
        {categories.map((item) => (
          <motion.button className={values.category === item.slug ? "is-active" : ""} onClick={() => onCategoryChange(item.slug)} type="button" key={item.slug} layout="position" {...pressFeedback(reducedMotion)}>
            <span>{item.index}</span><strong>{item.label}</strong><FilterSelectionMark visible={values.category === item.slug} />
          </motion.button>
        ))}
      </fieldset>

      <CatalogCombobox
        label="BPRS penerbit"
        placeholder="Cari nama BPRS"
        emptyMessage="BPRS tidak ditemukan."
        options={publisherOptions}
        selectedKey={values.bprs}
        inputValue={values.bprsInput}
        onInputChange={onBprsInputChange}
        onSelectionChange={selectPublisher}
      />

      <div className="catalog-province-filter">
        <CatalogCombobox
          label="Provinsi aset"
          placeholder="Cari atau ketik provinsi"
          emptyMessage="Provinsi tidak ditemukan."
          options={provinceOptions}
          selectedKey={values.provinceKey}
          inputValue={values.province}
          onInputChange={onProvinceInputChange}
          onSelectionChange={selectProvince}
        />
      </div>

      {mode === "desktop" && activeFilters > 0 ? (
        <motion.button className="filter-reset" type="button" onClick={onReset} {...pressFeedback(reducedMotion)}>
          <ArrowCounterClockwise aria-hidden="true" />Atur ulang filter
        </motion.button>
      ) : null}
    </div>
  );
}

function CatalogSearch({ query, onSubmit, onClear }: CatalogSearchProps) {
  const reducedMotion = useReducedMotion();
  const [value, setValue] = useState(query);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(value.trim());
  }

  return (
    <form className="catalog-search" role="search" onSubmit={submit}>
      <MagnifyingGlass aria-hidden="true" />
      <label className="sr-only" htmlFor="catalog-search-input">Cari aset</label>
      <input
        id="catalog-search-input"
        type="text"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Cari rumah, tanah, kendaraan, atau lokasi"
        autoComplete="off"
      />
      {value ? <motion.button className="catalog-search-clear" type="button" onClick={onClear} aria-label="Hapus pencarian" {...pressFeedback(reducedMotion)}><X aria-hidden="true" /></motion.button> : null}
      <motion.button className="catalog-search-submit" type="submit" {...pressFeedback(reducedMotion)}>Cari aset <ArrowRight aria-hidden="true" /></motion.button>
    </form>
  );
}

function DesktopFilterPanel({
  categories,
  publisherOptions,
  provinceOptions,
  category,
  bprs,
  publisherName,
  province,
  provinceKey,
  activeFilters,
  onCategoryChange,
  onBprsChange,
  onProvinceChange,
  onReset,
}: DesktopFilterPanelProps) {
  const [bprsInput, setBprsInput] = useState(publisherName);
  const [provinceInput, setProvinceInput] = useState(province);

  return (
    <FilterPanel
      mode="desktop"
      categories={categories}
      publisherOptions={publisherOptions}
      provinceOptions={provinceOptions}
      values={{ category, bprs, bprsInput, province: provinceInput, provinceKey }}
      activeFilters={activeFilters}
      onCategoryChange={onCategoryChange}
      onBprsInputChange={setBprsInput}
      onBprsChange={onBprsChange}
      onProvinceInputChange={setProvinceInput}
      onProvinceChange={onProvinceChange}
      onReset={onReset}
    />
  );
}

export default function CatalogClient({ items, categories, publishers, provinces, nextCursor }: CatalogClientProps) {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const q = params.get("q") ?? "";
  const category = params.get("category") ?? "all";
  const bprs = params.get("bprs") ?? "all";
  const province = params.get("province") ?? "";
  const sort = params.get("sort") ?? "terbaru";
  const publisherName = publishers.find((publisher) => publisher.slug === bprs)?.name ?? "";
  const [filterOpen, setFilterOpen] = useState(false);
  const initialProvinceKey = province
    ? (provinces.includes(province) ? province : null)
    : "all";
  const [mobileDraft, setMobileDraft] = useState<FilterValues>({ category, bprs, bprsInput: publisherName, province, provinceKey: initialProvinceKey });

  const publisherOptions = useMemo<CatalogFilterOption[]>(() => [
    { id: "all", label: "Semua penerbit", supporting: "Seluruh BPRS terhubung" },
    ...publishers.map((publisher) => ({
      id: publisher.slug,
      label: publisher.name,
      supporting: `${publisher.city}, ${publisher.province} · ${publisher.publishedAssetCount} aset`,
      markUrl: publisher.markUrl,
    })),
  ], [publishers]);

  const provinceOptions = useMemo<CatalogFilterOption[]>(() => [
    { id: "all", label: "Semua provinsi" },
    ...provinces.map((item) => ({ id: item, label: item })),
  ], [provinces]);

  function routeWith(changes: Partial<Record<FilterKey, string>>, cursor?: string | null) {
    const next = new URLSearchParams(params.toString());
    next.delete("cursor");
    Object.entries(changes).forEach(([key, value]) => {
      if (!value || value === "all" || (key === "sort" && value === "terbaru")) next.delete(key);
      else next.set(key, value);
    });
    if (cursor) next.set("cursor", cursor);
    return `${pathname}${next.size ? `?${next}` : ""}`;
  }

  function update(key: FilterKey, value: string) {
    router.push(routeWith({ [key]: value }), { scroll: false });
  }

  function submitSearch(value: string) {
    router.push(routeWith({ q: value }), { scroll: false });
  }

  function clearSearch() {
    router.push(routeWith({ q: "" }), { scroll: false });
  }

  function resetAll() {
    router.push(pathname, { scroll: false });
  }

  function resetFilters() {
    router.push(routeWith({ category: "all", bprs: "all", province: "" }), { scroll: false });
  }

  function handleFilterOpen(open: boolean) {
    if (open) setMobileDraft({ category, bprs, bprsInput: publisherName, province, provinceKey: initialProvinceKey });
    setFilterOpen(open);
  }

  function applyMobileFilters() {
    router.push(routeWith({
      category: mobileDraft.category,
      bprs: mobileDraft.bprs,
      province: mobileDraft.province.trim(),
    }), { scroll: false });
    setFilterOpen(false);
  }

  function resetMobileFilters() {
    setMobileDraft({ category: "all", bprs: "all", bprsInput: "", province: "", provinceKey: "all" });
  }

  const activeFilters = [category !== "all", bprs !== "all", Boolean(province)].filter(Boolean).length;
  const hasSearchCriteria = Boolean(q.trim()) || activeFilters > 0 || Boolean(params.get("cursor"));
  const mobileActiveFilters = [mobileDraft.category !== "all", mobileDraft.bprs !== "all", Boolean(mobileDraft.province)].filter(Boolean).length;
  const draftMatchesApplied = mobileDraft.category === category
    && mobileDraft.bprs === bprs
    && mobileDraft.province.trim() === province;
  return (
    <section className="catalog-shell site-frame">
      <div className="catalog-toolbar">
        <CatalogSearch key={q} query={q} onSubmit={submitSearch} onClear={clearSearch} />

        <div className="catalog-toolbar-actions">
          <label className="catalog-sort">
            <span>Urutkan</span>
            <select value={sort} onChange={(event) => update("sort", event.target.value)} aria-label="Urutkan katalog">
              <option value="terbaru">Terbaru</option>
              <option value="terlama">Terlama</option>
            </select>
            <CaretDown aria-hidden="true" />
          </label>

          <Dialog.Root open={filterOpen} onOpenChange={handleFilterOpen}>
            <Dialog.Trigger asChild>
              <motion.button className="mobile-filter-trigger" type="button" {...pressFeedback(reducedMotion)}>
                <FadersHorizontal weight={activeFilters ? "bold" : "regular"} aria-hidden="true" />
                <span>Filter{activeFilters ? ` · ${activeFilters}` : ""}</span>
              </motion.button>
            </Dialog.Trigger>
            <AnimatePresence>
              {filterOpen ? (
                <Dialog.Portal forceMount>
                  <Dialog.Overlay asChild forceMount>
                    <motion.div
                      className="filter-sheet-overlay"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: PUBLIC_MOTION_DURATION.fast }}
                    />
                  </Dialog.Overlay>
                  <Dialog.Content asChild forceMount aria-describedby={undefined}>
                    <motion.div
                      className="filter-sheet"
                      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 32 }}
                      animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                      exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 20 }}
                      transition={{ duration: PUBLIC_MOTION_DURATION.standard, ease: PUBLIC_MOTION_EASE }}
                    >
                      <div className="filter-sheet-head">
                        <div><span>Atur pencarian</span><Dialog.Title>Filter katalog</Dialog.Title></div>
                        <Dialog.Close asChild><motion.button type="button" aria-label="Tutup filter" {...pressFeedback(reducedMotion)}><X aria-hidden="true" /></motion.button></Dialog.Close>
                      </div>
                      <div className="filter-sheet-body">
                        <FilterPanel
                          mode="mobile"
                          categories={categories}
                          publisherOptions={publisherOptions}
                          provinceOptions={provinceOptions}
                          values={mobileDraft}
                          activeFilters={mobileActiveFilters}
                          onCategoryChange={(value) => setMobileDraft((current) => ({ ...current, category: value }))}
                          onBprsInputChange={(value) => setMobileDraft((current) => ({ ...current, bprsInput: value }))}
                          onBprsChange={(value) => setMobileDraft((current) => ({ ...current, bprs: value }))}
                          onProvinceInputChange={(value) => setMobileDraft((current) => ({ ...current, province: value }))}
                          onProvinceChange={(value) => setMobileDraft((current) => ({ ...current, province: value, provinceKey: value || "all" }))}
                          onReset={resetMobileFilters}
                        />
                      </div>
                      <div className="filter-sheet-footer">
                        <motion.button type="button" onClick={resetMobileFilters} {...pressFeedback(reducedMotion)}><ArrowCounterClockwise aria-hidden="true" />Atur ulang</motion.button>
                        <motion.button className="filter-sheet-apply" type="button" onClick={applyMobileFilters} {...pressFeedback(reducedMotion)}>
                          {draftMatchesApplied ? `Tampilkan ${items.length} aset` : "Tampilkan hasil"}<ArrowRight aria-hidden="true" />
                        </motion.button>
                      </div>
                    </motion.div>
                  </Dialog.Content>
                </Dialog.Portal>
              ) : null}
            </AnimatePresence>
          </Dialog.Root>
        </div>
      </div>

      <div className="catalog-body">
        <aside className="catalog-filter-rail" aria-label="Filter katalog">
          <DesktopFilterPanel
            key={`${bprs}\u0000${province}`}
            categories={categories}
            publisherOptions={publisherOptions}
            provinceOptions={provinceOptions}
            category={category}
            bprs={bprs}
            publisherName={publisherName}
            province={province}
            provinceKey={initialProvinceKey}
            activeFilters={activeFilters}
            onCategoryChange={(value) => update("category", value)}
            onBprsChange={(value) => update("bprs", value)}
            onProvinceChange={(value) => update("province", value)}
            onReset={resetFilters}
          />
        </aside>

        <div className="catalog-results">
          {items.length ? (
            <>
              <LayoutGroup id="catalog-results">
                <motion.div
                  className="catalog-grid"
                  layout={reducedMotion ? false : true}
                  transition={{ duration: PUBLIC_MOTION_DURATION.standard, ease: PUBLIC_MOTION_EASE }}
                >
                  {items.map((asset, index) => <AssetCard asset={asset} size={index % 5 === 0 ? "wide" : "standard"} key={asset.id} />)}
                </motion.div>
              </LayoutGroup>
              {nextCursor ? (
                <motion.a className="catalog-next-page" href={routeWith({}, nextCursor)} {...pressFeedback(reducedMotion)}>
                  <span>Lihat aset berikutnya</span>
                  <ArrowRight aria-hidden="true" />
                </motion.a>
              ) : null}
            </>
          ) : (
            <div className={`catalog-empty ${hasSearchCriteria ? "catalog-empty--search" : "catalog-empty--initial"}`}>
              <span aria-hidden="true">00</span>
              <div>
                <p>{hasSearchCriteria ? "Pencarian selesai" : "Katalog belum tersedia"}</p>
                <h2>{hasSearchCriteria ? "Tidak ada hasil pencarian." : "Belum ada aset yang diterbitkan."}</h2>
                <p>{hasSearchCriteria ? "Coba gunakan kata yang lebih umum atau kurangi filter yang digunakan." : "Aset akan tampil setelah BPRS menyelesaikan pemeriksaan dan menerbitkan publikasinya melalui ruwang."}</p>
              </div>
              {hasSearchCriteria ? <motion.button type="button" onClick={resetAll} {...pressFeedback(reducedMotion)}>Atur ulang pencarian</motion.button> : null}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
