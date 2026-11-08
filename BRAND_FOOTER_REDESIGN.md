# Wordmark dan footer minimalis

15 September 2026. Pembaruan setelah CONTROLS_REDESIGN.md; scope hanya keputusan wordmark, kontrol tema yang lebih tenang, dan footer yang disetujui pemilik.

## Hasil

- Wordmark dua baris: `seputar jaminan` dengan pemisahan optis dan bobot 500/650, lalu `by ruwang` berukuran 12px. Manrope/Source Sans 3 lokal yang sudah tersedia tetap digunakan. Tidak menambahkan simbol rumah/perisai/palu. Belum ditemukan aset wordmark resmi Ruwang untuk dipakai; tulisan ini bukan klaim reproduksi logo resmi.
- Satu BrandLockup dipakai header, menu mobile, dan footer. Label aksesibel tunggal dan tautan beranda dipertahankan.
- Kontrol tema tetap tiga ikon satu klik; hanya border dan latar grup dibuat lebih tenang. Penyimpanan/default perangkat dan reduced motion tidak diganti.
- Footer menjadi dua baris desktop: identitas dan tiga tautan; copyright dan satu kalimat `Informasi lanjutan melalui BPRS pada detail aset.` Ponsel tersusun vertikal. Tidak ada nomor navigasi, panah, garis vertikal, divider antartautan, atau pengantar berulang. Tinggi target tautan minimal 44px dan focus ring tetap terlihat.
- Footer mengikuti chalk pada light dan background gelap pada dark. Warna menggunakan token semantik. CSS module mencegah benturan dengan styling editorial lama; tidak melakukan penghapusan massal CSS pengguna.
- Label SIMULASI LOKAL tetap hanya di wrapper preview 4433 selama foto/logo contoh digunakan. Komponen aplikasi tidak memuat banner tersebut. Saat beralih ke data nyata, wrapper contoh dihentikan, bukan menyamarkan contoh sebagai publikasi nyata.

## File utama

- `app/components/BrandLockup.tsx` dan `BrandLockup.module.css`.
- `app/components/SiteFooter.tsx` dan `SiteFooter.module.css`.
- `app/components/ThemeControl.module.css`.
- `tests/rendered-html.test.mjs`: identitas aksesibel, struktur wordmark baru, navigasi footer tanpa ornamen. Dua assertion 404 lama yang mencari teks nama utuh dalam HTML disesuaikan ke label aksesibel karena wordmark kini terdiri atas span terpisah; pengujian 404 tetap dipertahankan.
- `tests/design-foundation.test.mjs`: module wordmark ikut pemeriksaan warna terpusat.

## Verifikasi aktual

- Lint dan typecheck PASS. Lint terarah dijalankan ulang setelah koreksi assertion tes dan PASS.
- Kontrak 8/8 dan fondasi 7/7 PASS.
- Production build PASS: `l3r0XVsSCezBHv6JayyAr`.
- Run npm test awal gagal pada dua assertion teks 404 lama. Setelah koreksi assertion, rendered 38/38 PASS; browser 5/5 PASS. Tidak mengklaim run npm test pertama lolos.
- QA khusus wordmark/footer: 102/102 PASS pada light/dark dan lebar CSS 360, 390, 768, 1024, 1440. Meliputi lebar aktual, overflow, ukuran signature, bobot wordmark, warna footer, menu mobile/Escape/pengembalian fokus, tiga tautan footer via keyboard, target sentuh, link logo ke beranda, dan runtime error.
- Regresi enam halaman (beranda/katalog/detail/direktori/profil/panduan), lima lebar CSS, dua tema: 60/60 PASS. Tidak terdeteksi console/page error, horizontal overflow, nested link/control, filter warna foto atau fallback media gagal dalam matriks tersebut. Font lokal terdeteksi dimuat. Ini bukan audit semua browser/perangkat atau seluruh kondisi data.
- HTTP preview wrapper dan app 200; banner hanya ada di wrapper.
- Klik Terang/Gelap, navigasi footer ke direktori, reload dan persistensi pilihan PASS. Mode Ikuti perangkat merespons perubahan perangkat dark lalu light. Harness pertama salah menarget input radio yang disembunyikan React Aria; setelah mengklik label visual yang menaungi input (tanpa force), semua perjalanan lolos. Tidak mengubah komponen untuk mengatasi kesalahan locator ini. Screenshot terpotong fokus footer: `brand-footer-close-light.png` dan `brand-footer-close-dark.png`.
- Git diff --check PASS dengan peringatan normalisasi LF/CRLF Git yang sudah ada, bukan error whitespace.
- Preview lama sempat menyajikan chunk usang setelah build baru. Proses sample/Next yang identitasnya diverifikasi dihentikan dan dimulai ulang; pengujian final memakai proses baru. Tidak ada penghentian proses Node secara massal.

## Bukti dan cara meninjau

Preview pemilik: http://127.0.0.1:4433/ (simulasi lokal, WhatsApp dinonaktifkan). QA app langsung: 4432; API contoh loopback: 4431. Restart dari root repository dengan `node work/sample-preview.mjs` setelah memastikan port tidak dipakai instance yang masih berjalan. Jangan menjalankan dua instance atau rebuild di bawah Next produksi yang sedang melayani preview.

- `output/playwright/brand-footer-results.json`: seluruh hasil 102 cek dan matriks 60 view.
- `work/brand-footer-check.js`: pemeriksaan ulang komponen.
- `work/sample-matrix.js`: matriks existing; run ini memakai prefix screenshot `brand-final-` agar bukti lama tidak ditimpa.
- `output/playwright/brand-header-{light|dark}-{width}.png`, `brand-menu-*`, `brand-footer-*`: kondisi komponen lima ukuran. Beberapa capture fokus footer dibuat sebelum foto lazy-loaded di atasnya selesai; gunakan matriks full-page untuk evaluasi foto.
- `output/playwright/brand-final-{home|catalog|detail|directory|profile|help}-{light|dark}-{390|1440}.png`: 24 screenshot regresi full-page.

Screenshot representatif:

![Footer desktop terang](output/playwright/brand-footer-light-1440.png)
![Panduan desktop gelap](output/playwright/brand-final-help-dark-1440.png)
![Footer ponsel gelap](output/playwright/brand-footer-dark-360.png)

## Batas dan kelanjutan

Scope perubahan yang disetujui sudah diimplementasikan; tidak menambah animasi dekoratif atau merombak isi halaman di luar scope. Skill Playwright dipakai untuk memeriksa render, keyboard, tema dan screenshot, bukan sekadar source assertions.

Data uji tetap lima aset dan empat logo contoh terisolasi, bukan mitra atau agunan nyata. Integrasi API/data/kontak BPRS asli, perangkat fisik, dan persetujuan visual pemilik tetap belum dibuktikan oleh pengujian ini. Tidak menyatakan website sempurna atau siap peluncuran nasional. Tidak ada commit/push/deploy, perubahan backend/database, pesan WhatsApp, atau perubahan media contoh pada turn ini.
