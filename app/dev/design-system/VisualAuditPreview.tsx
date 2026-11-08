import AssetCard from "../../components/AssetCard";
import AssetDetailGallery from "../../components/AssetDetailGallery";
import BprsMark from "../../components/BprsMark";
import PublicLoadingState from "../../components/PublicLoadingState";
import type { Asset, AssetMedia } from "../../data/catalog";

// Development-gated parent only. Images are fulfilled by the local browser QA
// fixture; no live/public endpoint is seeded with these specimens.
const media = (digit: string, width: number, height: number, label: string): AssetMedia => ({url: `/media/${digit.repeat(8)}-${digit.repeat(4)}-4${digit.repeat(3)}-8${digit.repeat(3)}-${digit.repeat(12)}`,width,height,altText:label});
const portrait = media("7",900,1600,"Fixture portrait 900 × 1600 — bukan aset nyata");
const landscape = media("8",1600,900,"Fixture landscape 1600 × 900 — bukan aset nyata");
const base: Asset = {id:"DEV-AUDIT",slug:"dev-audit",title:"Specimen aset dengan nama sangat panjang untuk memeriksa pembungkusan teks pada kartu dan ruang informasi",categoryCode:"BANGUNAN",category:"bangunan",categoryLabel:"Bangunan",subtypeCode:"RUMAH",subtype:"Rumah",city:"Wilayah pengujian lokal",province:"Bukan publikasi BPRS",publisher:{name:"BPRS contoh development dengan nama panjang",slug:"dev-audit",markUrl:""},cover:portrait,status:"Tersedia",photoCount:1,updatedAt:"2026-09-14"};

export default function VisualAuditPreview() {
  return <section className="shared-preview" aria-labelledby="visual-audit-title">
    <h2 id="visual-audit-title">Audit visual — fixture lokal, bukan publikasi nyata</h2>
    <p>Media uji hanya tersedia saat intersepsi browser QA aktif. Tidak diimpor halaman publik.</p>
    <div className="shared-preview-grid" data-audit-cards>
      <AssetCard asset={base} specs={[{label:"Luas tanah",value:"12.345 m²"},{label:"Luas bangunan",value:"987 m²"}]}/>
      <AssetCard asset={{...base,id:"DEV-VEHICLE",categoryCode:"KENDARAAN",category:"kendaraan",categoryLabel:"Kendaraan",subtypeCode:"TRUK",subtype:"Truk",cover:landscape}} specs={[{label:"Tahun",value:"2021"},{label:"Transmisi",value:"Manual"}]}/>
      <AssetCard asset={{...base,id:"DEV-EMPTY",cover:{...portrait,url:""},photoCount:0}}/>
      <AssetCard asset={{...base,id:"DEV-FAILED",cover:media("4",900,1600,"Foto gagal dimuat")}} variant="display" specs={[{label:"Jenis mesin",value:"Peralatan konstruksi dengan spesifikasi panjang"}]}/>
    </div>
    <div className="shared-preview-actions" data-audit-logos>{["1","2","3","5"].map((digit,index)=><div key={digit}><p>{["Lebar / transparan","Tinggi / transparan","Persegi / transparan","Berlatar putih"][index]}</p><div style={{width:160,height:100}}><BprsMark profile={{name:`Logo fixture ${digit}`,slug:"dev-audit",markUrl:media(digit,160,100,"Logo").url}}/></div></div>)}</div>
    <div style={{maxWidth:800}} data-audit-gallery><AssetDetailGallery assetId="DEV-GALLERY" assetTitle="Galeri fixture portrait dan landscape" images={[portrait,landscape]}/></div>
    <h2>Skeleton per halaman</h2>
    {(["home","catalog","detail","directory","profile"] as const).map(variant=><div key={variant} data-audit-loading={variant}><PublicLoadingState variant={variant}/></div>)}
  </section>;
}
