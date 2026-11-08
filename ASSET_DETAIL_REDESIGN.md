# Tahap 6 — detail aset dan WhatsApp

Checkpoint: 14 September 2026. Scope: frontend publik; bukan release/deployment.

## Hasil dan peta komponen

- `app/aset/[slug]/page.tsx`: identitas aset, status dari mapper, lokasi aset, BPRS penerbit, spesifikasi publik, deskripsi dengan baris baru, tanggal pembaruan, dan aset terkait memakai AssetCard bersama. CatalogReturnLink tahap 5 tetap dipertahankan, termasuk pada error.
- `app/aset/[slug]/detail.module.css`: grid desktop galeri kiri dan informasi kanan. DOM menempatkan satu heading aset sebelum galeri untuk mobile/screen reader. Ukuran judul adaptif, tidak dipotong. Panel kontak menjadi satu permukaan khusus; deskripsi/spesifikasi terbuka, bukan nested cards. Foto contain tanpa filter; logo beralas putih. Kartu terkait tetap tiga/dua/satu kolom, tidak memenuhi seluruh desktop ketika cuma satu hasil.
- `app/components/AssetDetailGallery.tsx`: PhotoSwipe existing lazy-loaded, thumbnail hanya >1 foto, tombol previous/next, ArrowLeft/ArrowRight pada foto utama, Enter membuka fullscreen, keyboard/swipe di fullscreen, Escape, fokus kembali tanpa memindahkan scroll. Pengumuman indeks aria-live; tidak autoplay; reduced motion dipertahankan. Placeholder defensif untuk array kosong, walau DTO publik menolak galeri kosong.
- `app/components/AssetContact.tsx` + CSS module: aksi langsung Hubungi BPRS, nama penerbit di dekat tindakan. Dock mobile fixed dengan safe-area dan spacer setelah footer; ResizeObserver menyesuaikan spacer terhadap nama panjang/teks error/ukuran layar. Tidak membuat perubahan global body saat navigasi. Lapisan galeri/menu di atas dock.
- `app/lib/public-whatsapp.ts`: validasi destination publikasi dan komposisi pesan yang dapat diuji tanpa jaringan. Tidak mengambil data internal atau nomor cadangan.
- Tests: perluasan `tests/rendered-html.test.mjs` dan scanner token `tests/design-foundation.test.mjs`; runner browser tambahan pada `work/stage6-*-qa.js`, screenshot `output/playwright/stage6-*.png`.

## Batas data/status yang sengaja dipertahankan

Sumber: `apps/api/src/public-service.ts` visibilityWhere/getAsset, `app/lib/public-api.ts`, `app/data/catalog.ts`. Tidak mengubah file backend, validator DTO, mapper atribut, atau kontrak.

- Hanya PUBLISHED + AVAILABLE, konfirmasi masih berlaku, institusi/profil ACTIVE, kontak VERIFIED, dan cover READY yang muncul. Status publik AVAILABLE tetap **Tersedia**, bukan siap dilelang/terverifikasi. Ikon SealCheck pada catatan lama dihapus agar tidak menyiratkan verifikasi aset.
- Aset tidak lagi memenuhi visibility: API mengembalikan 404 → not-found/noindex, tanpa CTA. Tidak memaksa status internal menjadi badge publik. Respons tidak sah seperti SOLD pada DTO AVAILABLE-only → error, bukan badge rekaan.
- Profil BPRS tambahan bersifat opsional; bila gagal, identitas dari detail tetap dipakai, lokasi kantor tidak dikarang. Lokasi aset dan lokasi kantor tidak dicampur.
- Spesifikasi berasal dari attributes publik kategori yang disiapkan API; luas memakai m², jarak km, jumlah lantai sesuai mapper existing. Objek attributes kosong tidak menghasilkan section kosong. Field wajib yang hilang tetap kegagalan kontrak, bukan normalisasi menjadi aset demo.
- Media melalui proxy same-origin; kegagalan foto memiliki placeholder aset, bukan logo BPRS. Galeri kosong tidak valid menurut API saat ini. QA foto rusak menguji load-error dengan URL media yang sah tetapi mengembalikan 404.

## Aturan WhatsApp

1. Nomor hanya diambil dari pathname `whatsapp_url` publikasi. API membentuknya dari relasi `publication.whatsappContact.phoneE164` yang VERIFIED. Tidak membaca kontak profil untuk menggantikan nomor ini.
2. Frontend menerima HTTPS `wa.me` dengan digit internasional 8–15, tanpa awalan nol, credentials, port nondefault, fragment, atau path tambahan. Validasi ini membuktikan format saja, bukan memastikan nomor memiliki akun WA atau selalu aktif.
3. URL tujuan dipertahankan; query pesan dibentuk ulang menjadi nama + kode aset + tautan publik `/aset/<kode>`. Pesan di-encode dengan URLSearchParams; karakter ampersand, slash, tanda tanya, hash, Unicode dan newline diuji. Browser origin menentukan lingkungan; tidak memakai host API, URL produksi hardcoded, `returnTo`, atau query katalog.
4. useSyncExternalStore menyediakan snapshot SSR stabil; sebelum hydration tombol menyatakan penyiapan, lalu aktif ketika origin browser tersedia. Tanpa JavaScript ditampilkan petunjuk mengaktifkannya. Tidak ada link aktif dengan data sementara/nomor global.
5. URL tidak valid → tombol disabled + alasan, detail lain masih dapat dibaca. URL kosong/hilang melanggar field wajib API → halaman error sesuai validator existing, tanpa CTA. Kontak tidak VERIFIED → publikasi disaring API, bukan ditampilkan dengan nomor pengganti.
6. Membuka WhatsApp di tab/aplikasi tujuan, pesan tetap draft sampai pengguna mengirim sendiri. Tidak ada modal izin, form lead, transaksi, harga, jadwal, bidding, atau pengiriman otomatis. Semua QA hanya memeriksa href; tidak menghubungi pihak luar.

## Verifikasi final

| Gate | Bukti |
| --- | --- |
| npm test | PASS: 8 kontrak, 6 fondasi/kontras, build produksi baru + TypeScript, 37 rendered tests. |
| TypeScript/lint/diff | npm run typecheck, ESLint terarah app + tiga file tes website, git diff --check PASS. Peringatan LF/CRLF bukan error. |
| Existing browser suite | 5/5 PASS terhadap build final: beranda, katalog/detail, filter mobile, PhotoSwipe, error API. |
| Browser utama | 61 checks PASS; light/dark × 1440/1024/768/390/320, satu h1, tanpa overflow/nested link/filter foto, URL WA, urutan mobile, spacer/footer, thumbnails, keyboard, focus return, no autoplay. Tidak ada console/page error di runner normal. |
| Edge browser | 138 checks, 48 view PASS; light/dark × 1440/390/320 × long/broken/invalid-WA/missing-WA/partial/inactive/invalid-status/single-photo. Swipe dengan browser touch events benar-benar memindahkan foto; fullscreen di atas dock; tidak ada pageerror. Console 404 pada fixture foto rusak disengaja dan ditinjau. |
| Regresi kembali | 6 checks PASS: detail reload → kembali ke URL katalog dan scroll pada desktop/mobile, menu Escape/focus. |
| Visual | Screenshot desktop/mobile light/dark, judul dan nama BPRS panjang, foto gagal, kontak invalid ditinjau. Media bidang warna adalah fixture, bukan gambar aset produksi. |

Runner awal edge salah menunggu h1 pada halaman error yang memakai h2; selector diperbaiki dan 48 view diulang. Runner kembali pertama membaca scroll sebelum katalog selesai loading; penantian aria-busy=false ditambahkan dan seluruh regresi diulang. Hasil awal gagal tidak dihitung sebagai PASS. Aplikasi final sudah dibuild ulang setelah perbaikan label layar penuh mobile.

## Pemeriksaan manual dan dependensi terbuka

- Route publik: `/aset/<kode-publikasi>`, masuk dari kartu beranda/katalog, thumbnail/fullscreen, profil BPRS, CTA, kembali ke katalog.
- Dev4411 masih hidup, tetapi upstream4410 tidak aktif saat verifikasi. Tidak menjalankan backend/database dengan konfigurasi tebakan. Karena itu detail data BPRS nyata belum dapat diperiksa di4411; tampilan error yang jujur bukan indikasi placeholder produksi.
- Fixture hanya test server lokal ephemeral; contoh SJ-TEST0091–0098 tidak ditambahkan ke aplikasi atau database. Tidak ada demo dipublikasikan. Foto/logo asli, seluruh variasi spesifikasi kategori pada dataset nyata, konfigurasi WA aktual, Firefox/WebKit, perangkat fisik dengan notch/keyboard, screen reader, dan uji orang awam masih memerlukan verifikasi integrasi.
- Tahap 6 selesai dalam scope implementasi + QA frontend ini; bukan pernyataan seluruh website atau deployment selesai. Tidak ada commit/push/deploy, perubahan dependency/environment/API, atau migrasi data. CSS detail legacy yang tidak terpakai tidak dibersihkan massal agar tidak menyentuh fitur di luar scope.
