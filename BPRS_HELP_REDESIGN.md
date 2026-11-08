# Tahap 7 — jalur BPRS dan bantuan penggunaan

Checkpoint 14 September 2026. Scope frontend publik di `D:\seputarjaminan-production`.

## Keputusan dan perubahan

### Direktori `/bprs`

- Judul **Daftar BPRS** dan pengantar menyebut BPRS dengan aset yang tersedia **di katalog Seputarjaminan**, bukan seluruh BPRS Indonesia.
- Baris custom: logo beralas putih, nama, lokasi kantor, jumlah aset API, dan Lihat profil dalam satu anchor tanpa nested link. Nama membungkus; satu penerbit memiliki komposisi lebih lapang dengan batas960px; mobile tetap ringkas tanpa deskripsi panjang di daftar.
- Jumlah direktori dilabeli **BPRS pada halaman ini**, bukan total nasional atau total semua halaman. Jumlah aset per BPRS berasal dari `published_asset_count`, bukan panjang array kartu. Angka negatif/noninteger tidak ditampilkan sebagai jumlah yang sah.
- Pencarian muncul untuk >=8 entri, adanya filter, atau halaman cursor; untuk daftar pendek tidak menambahkan kontrol yang belum diperlukan. Pencarian nama/kota/wilayah dan provinsi kantor mengikuti API. Tidak menyamakan lokasi kantor dengan lokasi aset.
- Form GET native dengan tombol **Tampilkan hasil**: ketikan belum mengubah hasil. Parameter q/province di URL, submit filter baru tidak membawa cursor lama. Link Atur ulang; pagination manual berikutnya dan kembali ke halaman pertama mempertahankan query/province. Back/forward browser mempertahankan konteks.
- Empty direktori, no-results, halaman cursor kosong, dan gangguan API memiliki pesan/aksi berbeda; tidak menampilkan jumlah palsu pada error.

### Profil `/bprs/<slug>`

- Logo160×128 desktop/128×96 mobile, contain pada putih, terpisah dari foto aset. Identitas/nama/lokasi/deskripsi publik, jumlah faktual kecil alih-alih angka dekoratif sangat besar.
- Daftar aset menggunakan AssetCard bersama tahap3, grid3/2/1 kolom, kartu dibatasi450px. Heading tidak mengulang nama BPRS panjang. Nol aset tetap menampilkan profil dan jalan ke katalog; gagal mengambil aset bukan dianggap nol.
- Tautan kembali ke direktori, katalog umum, katalog terfilter BPRS, dan panduan tersedia. Jika API mengembalikan next_cursor, ada **Lihat aset berikutnya** menuju katalog dengan bprs + cursor; total profil bukan jumlah kartu24 pada halaman pertama.
- Tidak menampilkan kontak internal, badge verifikasi, atau penjelasan proses admin. Kontak tetap berada pada detail aset sesuai publikasinya, bukan satu nomor global profil.

### Panduan `/cara-minat` — label **Cara menghubungi**

- Tiga langkah visual, server-rendered: **Cari aset → Baca detail → Hubungi BPRS**.
- Menjelaskan kontak ditentukan BPRS untuk aset tersebut; nama/kode/link ikut dalam draft dan bisa diedit sebelum pengguna mengirim. Tidak menjanjikan tombol selalu aktif atau BPRS pasti menjawab.
- Dua FAQ native details/summary: tombol tidak mengirim otomatis; tindakan ketika kontak belum tersedia. Tidak ada preview pesan palsu, disclaimer berulang, badge ShieldCheck, jargon marketing/verifikasi/backend, atau daftar harga/jadwal.
- Satu kelompok aksi menuju katalog/direktori. Footer compact pada tiga halaman. Tidak menambahkan library atau animasi dekoratif; hover menggunakan token motion dan mematuhi reduced motion.

## Sumber data dan batas kontrak

`apps/api/src/public-service.ts` diperiksa read-only. listInstitutions mensyaratkan institusi/profil ACTIVE dan setidaknya satu publikasi yang memenuhi visibilityWhere. Count memakai _count.publications dengan visibilityWhere. getInstitution hanya mensyaratkan institusi/profil ACTIVE sehingga profil nol aset sah.

DTO public institution hanya nama/slug/logo/deskripsi/kota/provinsi/jumlah publikasi. Nomor telepon/alamat internal/email/tenant/user tidak ditambahkan ke UI. `app/lib/public-api.ts` dan kontrak tetap tidak diubah. Lokasi kantor berasal dari office_city_regency/office_province; daftar aset memakai institution public slug.

Logo yang gagal dimuat menggunakan fallback BprsMark/PublicMedia, tidak menggantinya dengan foto aset. Field logo kosong/hilang sendiri melanggar kontrak wajib API saat ini dan tetap menjadi error respons, bukan izin mengarang logo. Data/logo sintetis hanya berada di test server, tidak diubah ke data publik.

## Peta source

| Owner | Tanggung jawab |
| --- | --- |
| app/bprs/page.tsx | Query API/metadata/header/error direktori |
| app/components/BprsDirectory.tsx | Form GET, daftar, jumlah halaman, empty/pagination |
| app/bprs/[slug]/page.tsx | Profil publik, daftar aset, count dan continuation |
| app/bprs/bprs.module.css | Gaya scoped direktori/profil, responsive/token/hover |
| app/cara-minat/page.tsx | Header, dua FAQ, CTA ringkas |
| app/components/InterestJourney.tsx | Tiga langkah server-rendered tanpa dependency interaksi tambahan |
| app/cara-minat/help.module.css | Layout langkah/FAQ desktop dan mobile |
| tests/rendered-html.test.mjs | Fixture khusus QA, assertion perilaku/kontrak/navigasi/count |
| tests/design-foundation.test.mjs | Memasukkan kedua CSS module dalam audit warna terpusat |

## Bukti QA

- Browser utama: **147 checks, 50 view PASS**; light/dark ×1440/1024/768/390/320, direktori9, profil1, panduan, profil0, nama panjang. Tidak ada overflow, nested interactive links, filter foto, atau pageerror. Kartu<=450px, tiga langkah/dua FAQ, draft/apply pencarian gabungan, no-results/reset, Back ke profil/filter, pagination, total server vs kartu halaman, href WA sesuai asset/penerbit diperiksa tanpa membuka/mengirim WhatsApp. FAQ Enter/Space diuji.
- Browser edge: **138 checks, 56 view PASS**; light/dark ×1440/768/390/320, direktori1 nama panjang, direktori0, logo list/profil gagal, error direktori, error aset terpisah dari profil, error profil dengan link keluar. Total285 pemeriksaan tambahan. Console404 untuk fixture logo rusak disengaja; tidak ada pageerror.
- Existing suite browser **5/5 PASS** pada source aplikasi tahap7: home/manual hero, katalog/detail, filter Escape/focus, PhotoSwipe, APIerror.
- Screenshot `output/playwright/stage7-*.png` ditinjau untuk direktori, profil, panduan, single/empty/broken, light/dark. Runner reproduksi pada `work/stage7-qa.js` dan `work/stage7-edge-qa.js`.
- `npm test` final selesai exit0:8 tes kontrak,6 fondasi/kontras, production build + TypeScript,38 rendered tests. ESLint terarah app + tes website selesai exit0. Quality gate tambahan dan pembersihan proses dicatat di REDESIGN_PROGRESS.md; jangan memakai status proses running sebagai bukti lulus.

### Hasil awal yang bukan PASS

Build aplikasi awal berhasil, tetapi tiga assertion gagal akibat judul/copy lama dan penggantian assertion empty beranda yang terlalu luas. Assertion beranda dipulihkan, dua judul route disesuaikan, dan tes diulang. Patch pertama ditolak karena duplicate target delete/add; tidak diterapkan, lalu diganti update yang sah melalui apply_patch.

Uji tambahan **tanpa JavaScript** menemukan direktori tetap menampilkan loading streaming Next: form ada pada DOM tetapi berada dalam segmen tersembunyi yang memerlukan script streaming. Tidak mengklaim direktori no-JS didukung, walau formulir menggunakan GET native. FAQ no-JS berhasil. Ini dependensi arsitektur yang dicatat, bukan disembunyikan dengan menghapus kegagalan; tidak mengubah streaming/layout global di tahap7. Runner edge diulang penuh, dan hasil diagnostik noJsDirectoryVisible=false dicatat terpisah dari pemeriksaan runtime normal.

## Dependensi terbuka / langkah pemeriksaan berikut

- Dev4411 hidup, upstream4410 tidak aktif. API/database nyata tidak dijalankan dengan konfigurasi tebakan. QA memakai fixture0/1/9BPRS dan5aset; jumlah fixture berasal dari snapshot sintetis, bukan bukti jumlah publikasi database produksi.
- Belum membuktikan seluruh logo asli/proporsi logo BPRS nyata, count/sort/cursor terhadap database hidup, skala besar, kondisi jaringan produksi, Firefox/WebKit/perangkat fisik, screen reader, dan uji pengguna awam. No-JS direktori masih batas eksplisit di atas.
- Implementasi hanya tahap7. Backend/API/kontrak/environment/dependency, konfigurasi WhatsApp tahap6, dan data produksi tidak diubah. Perubahan pengguna sebelumnya dipertahankan. Tidak ada commit/push/deploy. CSS legacy tidak dibersihkan massal.
- Untuk memeriksa dengan data asli kelak: `/bprs` → profil → kartu → detail → periksa nama BPRS dan href WA; uji query/province + cursor; buka profil nol aset; buka `/cara-minat` dan kedua FAQ.
