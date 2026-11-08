"use client";

import { useState } from "react";
import CatalogCombobox from "./CatalogCombobox";

/** Office location is not the asset-location filter. Suggestions are page-scoped. */
export default function DirectoryProvince({ initialProvince, provinces }: { initialProvince: string; provinces: string[] }) {
  const [province, setProvince] = useState(initialProvince);
  return <div>
    <input type="hidden" name="province" value={province.trim()} />
    <CatalogCombobox label="Provinsi kantor" placeholder="Cari provinsi kantor"
      allowsCustomValue inputValue={province} selectedKey={provinces.includes(province) ? province : null}
      options={provinces.map(value=>({id:value,label:value}))}
      onInputChange={setProvince} onSelectionChange={setProvince} onClear={()=>setProvince("")}
      description="Saran dari kantor BPRS pada halaman ini. Provinsi lain bisa diketik."
      emptyMessage="Tidak ada saran. Anda tetap dapat memakai provinsi yang diketik." />
  </div>;
}
