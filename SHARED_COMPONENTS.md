# Tahap 3 — komponen bersama dan navigasi

## Batas pekerjaan

Melanjutkan fondasi tahap 2 di repository yang sama, tanpa backend, kontrak API, environment, database, nomor WhatsApp, commit, push, atau deployment. Instruksi tahap 3 terbaru mengambil alih rencana lama untuk kartu: **quick-view bukan lagi jalur publik**. Kartu dan shell sudah masuk tahap ini; jangan mengulang implementasinya pada tahap berikutnya.

## Peta komponen

| Komponen / sumber | Kontrak dan pemakaian |
| --- | --- |
| `components/ui.tsx` | Button primary/secondary/text, TextLink native anchor, IconButton dengan nama aksesibel/ref React 19, SearchInput berlabel, SelectField, FilterChip aria-pressed, StatusBadge, SectionHeading, CardSurface, Divider. Button biasa default type=button; pencarian secara eksplisit submit. |
| `CatalogCombobox.tsx` | Combobox React Aria yang sudah ada, tetap controlled dan dapat dicari dengan keyboard. `allowsEmptyCollection` memungkinkan pesan tidak ditemukan benar-benar tampil. Tidak diganti dropdown buatan tanpa semantik. |
| `shared-components.css` | State interaksi dan adapter shell/layout bersama; diimpor sesudah fondasi. Semua warna memakai token tahap 2. |
| `AssetCard.tsx` + `AssetCard.module.css` | Kartu katalog tanpa bingkai panel yang membungkus seluruh isi. Foto 4:3, baris kategori/status, judul utuh, lokasi, penerbit/logo, referensi, CTA. Grid katalog konsisten dua kolom desktop, satu mobile; tidak ada kartu pertama raksasa. |
| `AssetShowcaseCard.tsx` | Varian pajangan beranda dari renderer data yang sama. Foto 3:2, panel informasi terpisah dengan garis samping, judul lebih ekspresif; dua kolom desktop/satu mobile. Bukan sekadar warna tombol berbeda. |
| `public-navigation.ts` | Satu sumber label: Katalog, Daftar BPRS, Cara menghubungi. URL tetap /katalog, /bprs, /cara-minat. |
| `SiteHeader.tsx` | Tinggi ringkas 72px desktop/64px mobile. CTA katalog duplikat dilepas. Kontrol tema tetap di header desktop dan menu mobile. Radix menangani dialog/focus trap/scroll lock/Escape; autofocus/restore memakai preventScroll. |
| `SiteFooter.tsx` | Label dari sumber navigasi yang sama, ritme vertikal lebih pendek; identitas ruwang dan keterangan penerbit tetap ada. |
| `PublicMedia.tsx` / `BprsMark.tsx` | Komponen media existing dipakai ulang. Placeholder foto berupa ikon foto + penjelasan, bukan logo bank. Logo fit=contain pada alas putih tanpa mengubah piksel; fallback inisial/ikon bank terpisah. |
| `dev/design-system/SharedPreview.tsx` | Specimen sintetis developer-only: judul/nama penerbit panjang, foto/logo tidak tersedia, spesifikasi opsional, controls/states. Tidak di navigasi publik; route production tetap not-found/noindex tanpa specimen. |

## Aturan kartu/data

- Foto, judul, dan CTA detail berasal dari variabel `detailHref` yang sama. Tidak ada nested link, stretched link di atas kontrol lain, atau click handler seluruh article.
- Tautan penerbit terpisah dari tautan aset, termasuk pada halaman profil BPRS.
- Kategori ditampilkan sekali; pengulangan kategori/subkategori lama dilepas. Nama spesifik tetap tersedia dalam judul/detail.
- Status hanya menampilkan `asset.status` hasil mapper publik yang sekarang hanya mendukung AVAILABLE → Tersedia. Token error/warning/info adalah state UI, bukan status aset baru.
- DTO daftar aset belum menyediakan spesifikasi. Kartu menerima `specs?: AssetSpec[]` hanya bila caller sudah memiliki spesifikasi publik; maksimal dua isian nonkosong. Jangan menambah request detail per kartu, menggunakan data internal, atau mengarang spesifikasi.
- Judul/nama penerbit panjang dibungkus, bukan dipotong dengan line-clamp. Foto tetap dominan; informasi tidak disembunyikan pada hover.
- Kartu tidak memakai initial opacity 0 atau layoutId bersama modal, sehingga HTML awal dan no-JS tetap terbaca. Hover foto ringan mematuhi reduced motion.
- `AssetDossier` dan CSS legacy tidak dihapus agar source lama tetap tersedia; tidak diimpor/dipanggil kartu publik. Tes legacy source bukan bukti alur quick-view masih aktif. Endpoint detail publik tetap dipertahankan.

## Penyesuaian yang terbukti diperlukan

1. Tombol hapus pencarian harus mengosongkan draft input lokal, termasuk sebelum query dikirim. Ini diperbaiki saat mengganti search control; URL/filter semantics tetap sama.
2. Combobox existing menutup list kosong secara default, sehingga renderEmptyState tidak terlihat. Mengaktifkan allowsEmptyCollection diuji melalui hasil nihil dan pemilihan keyboard.
3. Tes lama yang menuntut quick-view/metadata tanggal/identitas penerbit tersembunyi disesuaikan dengan permintaan tahap 3. Teks dan link tetap diperiksa dalam HTML hasil render, bukan hanya source.

## Verifikasi dan bukti

Gunakan `npm test` untuk contract + foundation + **build baru** + rendered tests. Jangan menjalankan rendered tests terhadap .next lama lalu mengklaim source baru lulus. Browser suite yang sudah ada diganti dari skenario quick-view menjadi klik detail; filter dan PhotoSwipe detail tetap diregresi.

Skill Playwright digunakan untuk inspeksi browser. Eksplorasi lokal di `work/stage3-browser-qa.js` dan `work/stage3-edge-qa.js`; port fixture ephemeral harus disesuaikan setelah harness baru. Screenshot di `output/playwright/stage3-*.png`. Pengujian logo mengintersep respons **hanya pada browser tes** dengan bidang SVG sintetis horizontal, vertikal, persegi; tidak mengubah media server atau file publik.

Lihat checkpoint terbaru di REDESIGN_PROGRESS.md untuk pass/fail final dan proses yang sengaja masih aktif.

## Dependensi terbuka

API lokal 4410 belum tersedia saat pemulihan. Dev 4411 dapat menampilkan preview komponen tanpa API; katalog berdata diuji memakai harness terisolasi 5 aset/5 BPRS/3 media. Foto sintetis tidak membuktikan kualitas/crop foto produksi, keterbacaan setiap logo bank asli, performa real-world, WhatsApp nyata, lintas browser atau perangkat fisik. Pembaruan tahap 4: komposisi beranda, footer compact opsional dan animasi logo kiri-ke-kanan sudah ditangani; lihat HOME_REDESIGN.md. Redesign katalog/detail menyeluruh tetap tahap berikutnya.
