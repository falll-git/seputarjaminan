# Fondasi desain publik — tahap 2

Implementasi di `D:\seputarjaminan-production`. Tahap ini tidak mengubah komposisi halaman, kontrak data, sumber publikasi, atau tujuan WhatsApp. Hasil QA dan dependensi dicatat di `REDESIGN_PROGRESS.md`.

## Sumber nilai dan penggunaan

| Sumber | Tanggung jawab |
| --- | --- |
| `app/design-tokens.css` | Warna semantik berpasangan terang/gelap; font, ukuran teks, spacing, radius, shadow, motion. |
| `app/foundation.css` | State kontrol, focus, disabled, status, permukaan logo/media, adaptasi komponen lama tanpa mengubah urutan halaman. |
| `app/fonts.ts` | Dua font WOFF2 lokal melalui `next/font/local`, preload dan fallback terukur. |
| `app/lib/theme.ts` | Preferensi valid dan bootstrap sebelum body dicat. |
| `ThemeProvider.tsx` / `ThemeControl.tsx` | Store tema, OS/storage events, persistensi, kontrol desktop/menu mobile. |
| `app/dev/design-system/` | Preview development tanpa API dan tanpa tautan pada navigasi publik. |

- Komponen baru memakai `--color-background`, `--color-surface`, `--color-surface-elevated`, `--color-text`, `--color-text-supporting`, `--color-action`, `--color-on-action`, `--color-control-border`, dan peran state terkait. Jangan menambahkan hex/RGB per komponen.
- Alias lama (`--paper`, `--ink`, `--iris`, dll.) dipertahankan sebagai jembatan migrasi. Indigo tidak otomatis aman untuk kontrol di tema gelap: aksi gelap memakai sage dengan teks dark, tautan memakai indigo terang. Sage dekoratif memakai pasangan `--color-on-accent`.
- Border dekoratif/divider tidak dipakai sebagai satu-satunya penanda kontrol. Kontrol memakai `--color-control-border` (target 3:1), teks normal minimal 4.5:1.
- `--color-status-available-*` hanya untuk status publik nyata `AVAILABLE` / Tersedia. Token warning/error/info adalah state antarmuka, bukan status bisnis atau klaim verifikasi baru.
- Permukaan logo tetap putih, teks fallback indigo. Foto tidak difilter atau dibalik warnanya. Label/aksi di atas foto menggunakan alas media gelap agar tidak bergantung pada terang-gelap piksel foto.
- Panel editorial gelap yang sudah ada tetap gelap di kedua tema dengan pasangan inverse. Posisi/ukuran/grid/urutan bagian belum dirancang ulang.
- Ukuran teks efektif yang sebelumnya dimenangkan stylesheet marketplace dipertahankan. Tahap shell/kartu/katalog akan mengoreksi hierarki dan kepadatan sesuai audit, bukan pada tahap fondasi.

## Font

Manrope untuk heading, Source Sans 3 untuk isi/form/tombol serta metadata publik. Alias historis `--mono` kini mengikuti body; `--font-code` sistem monospace hanya untuk contoh kode developer.

Dua dependency exact `@fontsource-variable/manrope@5.3.0` dan `@fontsource-variable/source-sans-3@5.3.0`, lisensi SIL OFL 1.1 disertakan dalam package. Masing-masing satu file normal Latin variable: 24.836 dan 28.740 byte (total 53.576 byte sumber). Tidak memuat italic atau subset bahasa tambahan. Rentang variable mengakomodasi bobot komponen lama tanpa banyak berkas/font request.

`display: swap`, preload, dan metric-adjusted Arial fallback dari Next. Heading fallback Arial/sans-serif; body Segoe UI/Arial/sans-serif. Tidak ada request Google Fonts/CDN saat build atau browser. Paket IBM/Schibsted lama belum dihapus dari lockfile untuk menghindari churn dependency lain, tetapi impor runtime-nya sudah dilepas dan tidak lagi dimuat oleh halaman.

## Kontrak tema

- Default `system` / Ikuti perangkat; pilihan Terang (`light`) dan Gelap (`dark`) disimpan dalam localStorage `sj-theme` tanpa login.
- Nilai tidak valid kembali ke sistem. Jika storage diblokir, kontrol tetap bekerja di tab tersebut; reload kembali mengikuti perangkat karena pilihan tidak bisa disimpan.
- Script konstan di head menyetel atribut sebelum body, tanpa interpolasi input pengguna. `color-scheme` menjadi fallback sistem tanpa JavaScript.
- SSR dan hydration awal mempertahankan markup pilihan sistem/nonaktif yang sama. Store baru mengaktifkan kontrol di klien; tidak menutupi mismatch secara global. `suppressHydrationWarning` hanya pada html untuk atribut tema yang memang diubah bootstrap.
- Mode sistem mengikuti perubahan perangkat; mode manual mengabaikannya. Event storage menyinkronkan tab, timer/listener dibersihkan.
- Transisi warna 160 ms hanya ketika tema berubah, tidak saat first paint. Tidak mentransisikan/memfilter foto. Reduced motion menonaktifkan transisi tema. Animasi reveal/marquee lama belum didesain ulang pada tahap ini.
- Selector preview terang/gelap mendeklarasikan `color-scheme` dalam CSS, bukan inline: compiler CSS Next mentransformasi `light-dark()` dan perlu mengetahui scope kedua panel.
- Jika kelak CSP ketat ditambahkan, bootstrap perlu hash/nonce yang disediakan deployment. Saat audit tidak ada CSP yang memblokir script ini; jangan mematikan CSP untuk mengakomodasinya.

## Preview dan pengujian

Jalankan `npm run dev -- --hostname 127.0.0.1 --port 4411`, lalu buka `/dev/design-system`. Preview dapat diperiksa tanpa upstream API. Halaman publik membutuhkan layanan API yang memang dikonfigurasi; jangan menggantinya dengan demo.

Preview hanya dirender ketika `NODE_ENV=development`, tidak ada link publik, metadata noindex/nofollow. Dalam production, URL tersebut merender not-found tanpa specimen. Next bisa mengirim HTTP 200 untuk shell yang sudah streaming, diikuti not-found/noindex; ini bukan akses ke isi preview. Tes memeriksa isi respons, bukan kode HTTP saja.

- `npm run test:foundation`: pasangan kontras, bootstrap/storage fallback, sentralisasi warna, tanpa filter foto, font lokal, parity motion, batas preview.
- `npm test`: validasi kontrak yang sudah ada, fondasi, build produksi, rendered regression termasuk preview tertutup.
- `npm run typecheck`; ESLint terarah pada app dan tes yang berubah.
- `npm run test:browser`: suite browser existing, fixture terisolasi (tidak mengubah DB). Periksa child process saat cleanup di Windows.
- Eksplorasi tambahan menggunakan skill Playwright CLI; screenshot di `output/playwright`, skrip QA lokal di `work/stage2-*.js`. Full-page capture harus melewati bagian halaman untuk memicu reveal viewport yang sudah ada; screenshot sebelum scroll bukan bukti bahwa isi halaman hilang.

## Batas dan tahap selanjutnya

Tidak mengarang/mengubah data aset atau BPRS, status, harga, jadwal, nomor kontak, maupun backend. Sampel QA adalah fixture sintetik 5 aset/5 BPRS/3 foto; bukan foto produksi. Gate data nyata/WhatsApp nyata/lintas browser/perangkat fisik dan pengujian orang awam tetap terbuka.

Tahap berikutnya yang menunggu permintaan: shell/navigasi, kartu custom, katalog, beranda, detail/WA, BPRS, panduan, motion/state, QA menyeluruh. Marquee masih memakai arah lama ke kiri; target kiri-ke-kanan sengaja tetap tercatat untuk tahap motion, bukan diam-diam dikerjakan dalam fondasi.
