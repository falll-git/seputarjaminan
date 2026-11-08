# Penyempurnaan visual setelah review pemilik

## Cakupan dan checkpoint

Permintaan: bukan sekadar lolos fungsi; satukan karakter kartu, kontrol, hero, navigasi, dan motion. Pertahankan API, status, dan WhatsApp publikasi. Tidak memasang gabungan library atau menyalin template.

Resume: sesi terputus setelah inspeksi; belum ada patch implementasi refinement sebelum catatan ini. Worktree tahap sebelumnya serta perubahan backend pengguna dipertahankan.

## Arah

- Kartu katalog dengan bingkai foto halus dan hierarki judul/lokasi; pajangan satu keluarga tanpa garis samping tempelan.
- Hero lebih kompak, kategori lebih dekat pencarian; tidak menunda konten atau autoplay.
- Kontrol memakai ukuran, ikon, dan feedback konsisten. Referensi prinsip Untitled UI/coss; implementasi custom CSS Modules dan primitive existing.
- Menu mobile ringkas mengikuti tema, bukan halaman portfolio layar penuh.
- Motion fungsional: foto 2%, panah pendek, tekan tombol, panel singkat, logo kiri-ke-kanan. Reduced motion tetap statis.
- Foto/logo asli tidak diubah, tidak diganti stok atau data demo publik. Preview fixture tidak mewakili kualitas fotografi produksi.

## Siklus pemeriksaan

1. Kartu + kontrol → preview dan koreksi.
2. Hero + navigasi + penerbit + detail/panduan → preview dan koreksi.
3. Matrix responsive/light-dark, keyboard/filter/galeri/tema/marquee, state parsial.
4. Lint/typecheck/test/build; catat bukti final dan keterbatasan. Jangan klaim sempurna atau siap produksi dari fixture.

Status historis: implementasi dan verifikasi lokal selesai pada 14 September 2026. **Pembaruan kontrol terbaru menggantikan bagian native select dan preview pada dokumen ini: lihat [CONTROLS_REDESIGN.md](CONTROLS_REDESIGN.md).** Preview terbaru http://127.0.0.1:4433/ memakai media contoh terisolasi; port 49281 di bawah sudah dihentikan. Persetujuan visual dengan media asli tetap terbuka. Bukti tahap 11 adalah baseline historis, bukan hasil pemeriksaan perubahan ini.

## Hasil perubahan

- Kartu: radius 16px, katalog memakai bingkai foto inset 8px, pajangan foto full-width; judul/lokasi utama, footer tenang, publisher dan CTA tidak saling menutupi. Foto hover 2%, panah pendek, border dan shadow hover; tidak ada tilt/spotlight/glow.
- Kontrol: radius 10px, shadow kecil, chevron select dan ikon tema konsisten; native select tetap digunakan untuk menjaga perilaku keyboard/perangkat. Combobox BPRS dirapikan tanpa mengganti React Aria atau data filter.
- Hero: foto 3:2, caption menyatu, jarak kategori/pencarian lebih dekat; kategori mobile 2x2 dengan bidang ikon kecil. Kartu pajangan beranda stretch agar batas bawah satu baris sejajar.
- Katalog: tiga kolom mulai 1280px, dua pada tablet/lebar sedang, satu pada ponsel. Panel filter desktop dibatasi dengan surface. Skeleton mengikuti perubahan grid.
- Navigasi: panel mobile ringkas maksimal 420px, mengikuti tema, scroll panel untuk layar pendek, focus trap/Escape/restore tetap Radix. Pilihan Terang/Gelap/Ikuti perangkat tetap native accessible select dengan ikon.
- BPRS: logo rail lebih pendek dengan permukaan putih tanpa bingkai kotak tebal; mode statis mobile dua kolom. Arah, pause/fokus/duplikat/reduced-motion tidak diubah. Direktori mendapat respons panah; profil memakai kartu bersama baru.
- Detail/panduan/footer: feedback tekan kontrol galeri, penanda langkah konsisten, footer ringkas menjadi default seluruh halaman. Tidak mengubah nomor WA, status, API, harga/jadwal, atau identitas cakupan bank.

## Temuan dan siklus koreksi

1. Screenshot kartu awal masih terlalu besar pada 1440px → tiga kolom dan skeleton diselaraskan, matrix ulang PASS.
2. Menu terang mewarisi warna signature dari panel gelap lama → token teks/link tema, screenshot ulang PASS.
3. CSS panel 240ms sementara JS masih 280ms → konstanta diselaraskan; tes fondasi ulang 7/7.
4. Tes source lama mengunci radius modal 12px dan panel 280ms → ekspektasi diperbarui ke desain yang disengaja (20px/240ms), seluruh 38 rendered ulang PASS. Tidak menghapus cek perilaku/reduced motion.
5. Scratch harness tema sempat mengacu filename yang tidak ada; file scratch yang baru dibuat dihapus dan dibuat ulang dari sumber terverifikasi. Semua `work/refine-*.js` lolos `node --check`; tidak masuk kode aplikasi.

## Verifikasi aktual

Build produksi `Ap2qAFoXilVjJlGGHKn0M` berhasil. Lint, typecheck, diff-check PASS. Kontrak 8, fondasi 7, rendered 38, browser Chromium 5 PASS setelah koreksi. `npm test` percobaan pertama gagal pada ekspektasi desain lama; setelah koreksi suite terdampak dijalankan kembali dan lolos. Tidak mengklaim run pertama lolos.

Browser CLI: 34 perjalanan + 18 filter/return/pagination + 122 keyboard/interaksi/CTA + 24 marquee + 6 first-paint tema + 18 edge/hover = 222 pemeriksaan PASS. Matrix 60 view (enam route × 360/390/768/1024/1440 × light/dark) PASS, tanpa overflow horizontal/nested link/error console pada dataset normal. Font lokal termuat. Screenshot matrix memakai reduced motion untuk capture stabil; gerak diuji terpisah.

Specimen development terisolasi: 10 kombinasi viewport/tema untuk judul panjang, spesifikasi, media portrait/landscape/kosong/gagal, logo lebar/tinggi/transparan/putih, galeri contain, serta loading. SVG geometris hanya di-intercept browser QA; tidak ditambahkan ke publikasi. Error media pada skenario gagal memang disengaja.

Bukti: [hasil terstruktur](output/playwright/refine-results.json), [indeks screenshot](output/playwright/REFINEMENT_EVIDENCE.md). Screenshot dilihat untuk komposisi, bukan hanya dihitung otomatis.

## Preview dan batas

- Preview produksi lokal berfixture: http://127.0.0.1:49281/ — dipertahankan untuk review. Bukan data/publikasi nyata dan jangan mengirim ke nomor fixture.
- Server preview lama 57153 dihentikan secara spesifik sebelum build agar tidak menyajikan campuran chunk lama/baru. Tidak menghentikan Node lain secara massal.
- Sumber gambar dan logo yang tersedia di preview adalah blok WebP pengujian. Keindahan crop/kualitas fotografi nyata belum dapat disahkan. Belum ada API asli 4410, uji pengguna awam, Safari/Firefox/perangkat fisik, atau performa jaringan lapangan.
- Tidak memasang dependency baru, menyalin aset berlisensi, mengubah backend/data produksi, commit, push, deploy, atau mengirim WhatsApp.
- Panduan konten pada REDESIGN_FINAL tetap berlaku; desain katalog kini surface inset, bukan body terbuka. Motion 180/240ms; radius kontrol/surface/modal 10/16/20px. Media asli dan persetujuan pemilik diperlukan sebelum menyatakan visual final untuk peluncuran.
