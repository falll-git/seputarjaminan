# Seputarjaminan — handoff final redesign publik

14 September 2026 · Tahap 11 · cakupan: frontend publik di `D:\seputarjaminan-production`.

## Status dan batas

Acuan terbaru untuk wordmark dan footer: [BRAND_FOOTER_REDESIGN.md](BRAND_FOOTER_REDESIGN.md), 15 September 2026. Identitas dua baris dan footer minimalis diimplementasikan; 102 pemeriksaan komponen dan 60 view regresi lolos pada build `l3r0XVsSCezBHv6JayyAr`. Simulasi lokal tetap diberi label; batas integrasi produksi tidak berubah.

Update terbaru setelah screenshot dan permintaan pemilik: [CONTROLS_REDESIGN.md](CONTROLS_REDESIGN.md) adalah acuan saat ini, termasuk tema tiga ikon satu klik, filter/dropdown/search/scrollbar custom, hasil tes terbaru, sumber media sementara dan panduan restart. Preview berisi contoh: **http://127.0.0.1:4433/** (simulasi lokal; WhatsApp nonaktif). VISUAL_REFINEMENT.md dan tahap 11 di bawah adalah baseline historis. Kartu tetap surface utuh/inset, menu mobile ringkas, katalog tiga kolom mulai 1280px, radius 10/16/20px dan motion panel 240ms.

Finalisasi lokal berdasarkan bukti tahap 1–10. Pemeriksaan tahap 11 dan alamat preview final dicatat di `REDESIGN_PROGRESS.md`. Website bukan dinyatakan siap produksi: upstream asli 4410 belum aktif untuk verifikasi data/foto/nomor BPRS. Preview berdata menggunakan fixture loopback terisolasi, bukan publikasi nyata. Tidak ada commit, push, deploy, migrasi, perubahan data produksi, atau pengiriman WhatsApp.

Brief terbaru berlaku: chalk–indigo–sage, Manrope/Source Sans 3, animasi logo kiri→kanan. Ketentuan font/arah logo dari lampiran lama sudah digantikan brief berikutnya. Riwayat lengkap disimpan tanpa dibuang di `REDESIGN_HISTORY.md`.

## Halaman dan alur final

| Halaman | Hasil |
| --- | --- |
| `/` | Hero dan pencarian terpadu; kategori taxonomy mudah dijangkau; visual publikasi manual tanpa autoplay; BPRS dengan aset aktif; aset terbaru; panduan tiga langkah |
| `/katalog` | Heading ringkas; pencarian, jenis, provinsi, BPRS, sort existing; draft lalu Tampilkan hasil; chip satu per satu; reset; pagination manual; grid terbatas lebarnya |
| `/aset/[slug]` | Identitas awal, status publik, galeri/thumbnail/layar penuh, spesifikasi publik, deskripsi, BPRS, WhatsApp publikasi; CTA mobile dengan safe-area |
| `/bprs` dan `/bprs/[slug]` | Direktori sesuai cakupan data, logo proporsional, lokasi/count publik, profil dan aset penerbit; jalan kembali |
| `/cara-minat` | Cari aset → Baca detail → Hubungi BPRS; dua FAQ singkat; pesan dapat diedit sebelum dikirim |
| Loading/empty/error/404/offline | Skeleton per route, pesan jujur, no-match berbeda dari kosong, retry/reset relevan; media gagal berbeda dari foto belum tersedia |

Jalur inti: beranda → pencarian/kategori → katalog → detail → URL WhatsApp. Tambahan: direktori → profil → aset. Kartu beranda boleh langsung ke detail. Foto/judul/CTA kartu menuju aset yang sama; tidak ada quick-view kedua.

Query publik katalog: `q`, `category`, `province`, `bprs`, `sort`, `cursor`. Detail membawa `returnTo` yang dibatasi ke katalog. Back/Forward tetap bekerja; tombol kembali menggunakan penyimpanan posisi tab (30 menit). Jika storage diblokir, URL tetap aman tetapi pemulihan scroll eksplisit tidak dijamin. Opt-in scroll Next 16 pada root layout harus dipertahankan agar judul detail tidak tertinggal di atas viewport.

## Sistem desain dan pemilik komponen

| Sumber | Tanggung jawab |
| --- | --- |
| `app/design-tokens.css` | Background/surface/elevated, teks, action/link/focus/disabled, border/status, spacing/radius/type/motion; pasangan light/dark |
| `app/fonts.ts` | Dua variable WOFF2 lokal; Manrope heading, Source Sans 3 isi/kontrol; fallback dan display swap |
| `ThemeProvider`, `ThemeControl`, `app/lib/theme.ts` | Terang/Gelap/Ikuti perangkat; default OS, storage opsional, bootstrap sebelum paint, sinkron OS |
| `ui.tsx`, `shared-components.css` | Button/secondary/link/icon, SearchInput, SelectField, FilterChip, StatusBadge, SectionHeading, CardSurface, Divider |
| `AssetCard`, `AssetShowcaseCard` | Satu keluarga: katalog 4:3 dengan body terbuka, pajangan 3:2 dengan permukaan/garis samping; kategori sekali; BPRS terpisah tanpa nested link |
| `PublicMedia`, `BprsMark` | Proxy WebP publik, alt/dimensi/fallback; logo contain di kanvas putih; tidak memfilter/invert foto |
| `SiteHeader`, `SiteFooter` | Katalog / Daftar BPRS / Cara menghubungi; menu mobile fokus/Escape/pemicu; footer ringkas |
| `CatalogClient`, `CatalogCombobox`, `CatalogReturnLink` | Draft filter vs applied URL, popup aksesibel, reset/chip/pagination/kembali |
| `AssetDetailGallery`, `AssetContact` | PhotoSwipe lazy module, keyboard/zoom/swipe, kontak publikasi valid, origin browser, encoding dan safe-area |
| `BprsMarquee`, `PublicMotionProvider` | Rel logo linear 24 px/detik kiri→kanan; hover/fokus/manual pause; duplikat non-Tab/aria-hidden; jumlah sedikit dan reduced motion statis |

Palet: light background `#F6F7F3`, surface `#FFFFFF`, primary `#343F72`, sage `#CBD6BF`; dark background `#151925`, surface `#222A3C`. Gunakan token fungsi, bukan salin hex ke komponen baru. Logo putih dan canvas galeri gelap memang invariant untuk keterbacaan, bukan kegagalan tema. Feedback kecil 180 ms/panel 280 ms; zoom foto 2,5%; tidak ada pulsa badge/CTA WhatsApp atau scroll hijacking.

## Data publik dan bahasa

- Status dari mapper kontrak: `AVAILABLE` → **Tersedia**. Tidak menambah Siap dilelang/Terverifikasi sendiri. Publikasi nonpublik tidak dipaksa menjadi kartu/status publik.
- Nomor berasal dari `detail.whatsapp_url` yang dikonfigurasi publikasi. UI hanya menerima tujuan HTTPS `wa.me` valid, lalu menyiapkan nama, kode, tautan lingkungan aktif dengan encoding benar. Tidak menggunakan nomor global/fallback; tidak mengirim otomatis.
- Field WhatsApp hilang melanggar DTO saat ini → error detail. URL berstruktur string tetapi tujuan invalid → kontak disabled. Logo hilang juga bisa melanggar kontrak; fallback komponen bukan izin mengarang respons API.
- DTO daftar belum membawa spesifikasi: hanya tampilkan jika caller sudah punya spesifikasi publik; jangan melakukan request detail per kartu. Count katalog adalah jumlah halaman ini, bukan total server yang tidak tersedia.
- Tidak ada field harga/jadwal/jaminan, bidding, pembayaran, checkout, formulir lead atau login wajib. Pembicaraan lanjutan dilakukan di WhatsApp.
- Gunakan kalimat pendek dan nama tindakan nyata. Jangan klaim seluruh BPRS Indonesia terhubung. Jangan menampilkan kontak internal atau proses admin di halaman publik.

## Cleanup tahap 11

`PageIntro.tsx` dan selector `.page-intro*` di editorial/design-system/marketplace dihapus: pencarian source membuktikan tidak ada import/pemakai setelah heading katalog diganti. Pada selector gabungan, cabang komponen lain dipertahankan. File tracked lama dapat dipulihkan dari Git; bukti/progres tidak dibuang.

Cleanup sengaja terbatas. Dossier/lightbox/reveal legacy masih memiliki tes sumber historis; CSS global juga bercampur dengan komponen aktif. Tidak menghapusnya massal atau menghapus tes hanya untuk membuat cleanup tampak lengkap. Dependency font lama belum digunakan runtime tetapi lockfile tetap dipertahankan untuk menghindari perubahan dependency di finalisasi ini. Komponen/data/backend yang tidak terkait tidak disentuh.

## Cara menjalankan preview

### Dengan API lokal asli (belum diverifikasi hidup)

Pastikan konfigurasi lokal yang sudah ada benar dan API terotorisasi aktif di 4410. Jangan menebak environment/credential atau menjalankan worker ganda. Dari PowerShell:

```powershell
Set-Location D:\seputarjaminan-production
npm run dev -- --hostname 127.0.0.1 --port 4411
```

Buka `http://127.0.0.1:4411/`. Jika API tidak aktif, halaman harus menampilkan error jujur. Preview token/komponen development-only: `/dev/design-system`; tidak tampil dalam navigasi publik dan tidak tersedia sebagai specimen produksi.

### Preview visual berdata tanpa DB: fixture terisolasi

Hentikan hanya server fixture milik pengujian sebelum rebuild, jangan menghentikan semua Node. Jalankan build, lalu harness yang sudah ada:

```powershell
Set-Location D:\seputarjaminan-production
npm run build
$env:SJ_VISUAL_FIXTURE_HOLD='true'
$env:SJ_VISUAL_FIXTURE_ASSET_COUNT='5'
$env:SJ_VISUAL_FIXTURE_INSTITUTION_COUNT='9'
$env:SJ_VISUAL_FIXTURE_MEDIA_COUNT='3'
$env:SJ_VISUAL_FIXTURE_VARIANT='normal'
node --test --test-name-pattern='homepage merender state' tests/rendered-html.test.mjs
```

Tunggu `VISUAL_FIXTURE_READY=http://127.0.0.1:<port>` dan buka alamat itu. Port bersifat sementara; jangan memakai alamat run lama. Foto polos dan nama/nomor contoh adalah fixture saja. Jangan menghubungi nomor fixture. Ctrl+C pada proses tersebut mengakhiri preview; exit 1 saat penghentian hold disengaja bukan kegagalan tes. Setelahnya hapus hanya environment `SJ_VISUAL_FIXTURE_*` yang dipasang pada terminal itu atau tutup terminal.

## Bukti dan kualitas

- Tahap 9: 310 view, lima lebar CSS, dua tema, specimen foto/logo/state, keyboard/zoom. Batasnya di `VISUAL_AUDIT.md`.
- Tahap 10: 224 cek CLI, 5 browser resmi, 8 kontrak + 7 foundation + 38 rendered, lint/typecheck/build PASS. Regresi scroll normal, fokus/galeri/CTA, dan error state sudah diperbaiki pada tahap terkait. Bukan klaim tidak pernah ada kegagalan selama proses.
- Tahap 11: pengujian ulang dan bukti aktual dicatat di progres final serta `output/playwright/STAGE11_EVIDENCE.md`.
- Dua WOFF2 total 53.576 byte; gambar utama preload, lainnya native lazy. Worker existing menghasilkan WebP maksimal 2560 px. Tidak ada klaim performa foto asli dari WebP fixture kecil; hasil lab lokal/CLS bukan p75 produksi atau INP.

## Screenshot untuk review

Set final: [indeks tahap 11](output/playwright/STAGE11_EVIDENCE.md). Dua tema pada desktop 1440×900 dan mobile 390×900 mencakup beranda, katalog, detail, direktori, profil, panduan. Screenshot fixture tidak mewakili kualitas crop/foto/logo produksi. Bukti state, menu, filter, dan galeri sebelumnya tetap tersedia pada [tahap 9](output/playwright/STAGE9_EVIDENCE.md) dan [tahap 10](output/playwright/STAGE10_EVIDENCE.md).

## Panduan konten baru

1. Judul spesifik dan wajar (jenis aset + pembeda/lokasi), bukan kapital semua atau slogan panjang. Judul panjang tetap membungkus; jangan menyembunyikan informasi penting dengan truncation baru.
2. Gunakan foto aset yang benar-benar dipublikasikan: cover landscape biasanya cocok untuk kartu 4:3/3:2. Foto portrait tetap utuh di detail contain. Jangan memakai logo bank sebagai foto aset. Isi alt yang menjelaskan sudut/ruang; jangan menyertakan data internal di gambar/alt.
3. Logo BPRS asli, proporsi dipertahankan, contain di putih. Jangan paksa memenuhi kotak, mengubah hue, atau mengarang logo saat belum tersedia.
4. Isi lokasi dan spesifikasi publik sesuai taxonomy. Jangan mengisi nilai nol/strip palsu untuk field yang belum diketahui; UI boleh menghilangkan spesifikasi yang tidak tersedia.
5. Status, count, dan kontak berasal dari sistem; cek tujuan WhatsApp per publikasi serta akses publik aset. Pesan harus dapat diedit dan tidak dikirim otomatis.
6. Periksa konten baru pada 360/390/768/1024/1440, terang/gelap, satu/banyak/kosong, keyboard dan reduced motion. Pastikan judul, logo, foto, CTA tidak overlap. Jalankan regresi setelah mengubah komponen/token bersama.

## Keterbatasan terbuka

Integrasi data/API/nomor BPRS asli, akurasi query/sort/count database, seluruh variasi foto/logo nyata, Safari/Firefox, perangkat fisik/screen reader/keyboard virtual, jaringan mobile lapangan, dan uji orang awam belum tuntas. WhatsApp hanya URL tanpa pesan luar. Direktori/CTA tertentu membutuhkan JavaScript; scroll restore membutuhkan storage. Persetujuan visual pemilik produk masih diperlukan. Aplikasi terkait Ruwang Control/Ruwang Arsip serta deployment bukan bagian tahap ini.
