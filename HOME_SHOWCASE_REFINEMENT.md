# Pembaruan beranda terfokus — 17 September 2026

## Batas dan keputusan

Pembaruan ini mengikuti persetujuan carousel inspirasi OLX, shortcut kategori dan pencarian di atas. Bukan OPS11 dan bukan redesign menyeluruh. Palet chalk–indigo–sage, font, wordmark, footer, navigasi, marquee BPRS dan halaman selain beranda tetap dipertahankan. Tidak menyalin branding/banner OLX, menambah harga, quick-view, transaksi, login atau kontak WhatsApp baru.

- Pencarian GET `/katalog?q=...` ada di header hanya pada beranda. Desktop lebar satu baris, layar menengah/mobile baris kedua. Pengantar pendek: “Jelajahi aset dari BPRS”.
- Carousel memakai foto dominan dengan caption solid: kategori/status dari DTO, judul, lokasi, nama BPRS dan detail. Semua tautan dalam satu kartu menuju aset yang sama.
- Desktop menampilkan dua kartu dan petunjuk kartu berikutnya; mobile satu dan petunjuk berikutnya. Satu aset statis/dibatasi lebar. Dua aset menggunakan slide penuh (foto dan caption berdampingan di desktop); tiga aset desktop menggunakan satu kartu penuh dan sebagian kartu berikutnya agar loop tidak meninggalkan area kosong. Nol aset dan kegagalan API dibedakan.
- Dots/arrows/swipe/keyboard, rotasi sekitar enam detik. Hover menjeda sementara; fokus/interaksi manual menjeda sampai pengguna menekan Putar. Di luar layar/tab tersembunyi timer berhenti. Reduced motion menonaktifkan autoplay dan transisi. Tidak ada salinan DOM kartu.
- Empat shortcut berasal dari taxonomy aktual. Desktop empat kolom; mobile 2×2 agar pilihan tetap mudah dijangkau. Tidak ada kategori rekaan.
- `Aset terbaru` tetap tiga publikasi terbaru, tidak ikut shuffle.

## Kontrak dan data

`GET /v1/public/showcase` baru, tidak menerima filter/cursor/limit. Menghasilkan maksimal delapan kartu unik dengan `next_cursor: null`, `Cache-Control: no-store`. Sampel diambil dari seluruh populasi yang memenuhi predicate katalog: publikasi PUBLISHED/AVAILABLE, konfirmasi masih berlaku, instansi/profil aktif, kontak VERIFIED, cover READY. Tidak hanya mengambil beberapa publikasi paling baru.

Pemilihan memakai partial Fisher–Yates pada offset ID dalam transaksi RepeatableRead: satu count, maksimal delapan lookup ID, lalu batch DTO publik. Urutan stabil selama halaman terbuka, berubah saat permintaan baru; tidak ada shuffle berkala di browser atau fetch detail per kartu. API mengembalikan allowlist kartu yang sama dengan katalog; tidak ada total global/field internal baru. Frontend menolak respons invalid/duplikat, tanpa fallback dummy.

OpenAPI dan generated types diperbarui bersama. Website baru memerlukan API SJ yang mendukung endpoint ini. Kontrak event/ACK/Ruwang/Control dan database schema tidak diubah; repository lain tidak disentuh. Penyelarasan snapshot kontrak vendor lintas repository tetap pekerjaan terpisah, bukan klaim integrasi lintas aplikasi selesai.

## Komponen dan file

- Beranda: `app/page.tsx`, `app/home.module.css`.
- Header: `app/components/SiteHeader.tsx`, `HomeSearch.module.css`.
- Etalase: `HeroAssetCarousel.tsx`, `HeroAssetCarousel.module.css`.
- Loading: `PublicLoadingState.tsx`, `PublicLoadingState.module.css`.
- API/client: `apps/api/src/app.ts`, `public-service.ts`, `app/lib/public-api.ts`.
- Kontrak: `packages/contracts/openapi/openapi.v1.yaml`, `generated/openapi.d.ts`.
- Regresi: API unit showcase, central-services integration, rendered HTML, public-site browser.

## Verifikasi

Hasil final dan bukti lokal ada dalam checkpoint ignored `work/home-refresh/` agar tidak masuk kandidat release. `baseline.json` merekam hash sebelum perubahan; `gates.json`, `central.json`, dan laporan final mencatat hasil aktual. Screenshot: `output/playwright/home-refresh-*`.

Pengujian mutatif hanya menggunakan target PostgreSQL/storage OPS08 yang diverifikasi oleh guard, role runtime nyata, Redis, ClamAV dan worker. Gambar bidang warna dan nama OPS08 di screenshot adalah bahan uji, bukan agunan operasional. Fixture kondisi sedikit/kosong/error hanya pada harness loopback terpisah di `work/`, tidak ada jalur fallback dalam aplikasi normal. WhatsApp hanya diperiksa URL, tidak dibuka/dikirim.

## Menjalankan dan batas bukti

Gunakan script website/API dan pemisahan environment repository seperti operasional lokal sebelumnya; jangan memakai credential migration owner untuk runtime website/API. Build: `npm run build` dan `npm run build --workspace @seputarjaminan/api`. Untuk mengulang bukti lokal lengkap, periksa checkpoint sebelum menjalankan runner terisolasi; jangan arahkan runner tes ke database workflow lama.

Dataset backend nyata pengujian terdiri atas dua instansi, delapan aset, empat kategori; bukan benchmark skala seluruh bank Indonesia. Strategi offset perlu pengukuran ulang pada populasi besar sebelum menyatakan siap beban nasional. Chromium desktop/emulasi mobile bukan pengganti Safari/Firefox/perangkat fisik. Uji tab-background nyata bergantung dukungan host otomatis dan dilaporkan terpisah dari simulasi visibility event. Hasil ini tidak memberi izin deploy atau status produksi siap.

Konten baru: isi judul/nama BPRS/lokasi dengan benar, gunakan foto publik yang dapat diproses sistem dan alt text bermakna, pertahankan taxonomy/status/kontak dari sumber sah. Jangan mengunggah gambar banner berisi klaim harga/jadwal untuk mengganti foto aset.
