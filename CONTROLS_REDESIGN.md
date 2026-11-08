# Kontrol custom dan preview berisi media contoh

14 September 2026. Acuan terbaru setelah VISUAL_REFINEMENT.md. Repository: `D:\seputarjaminan-production`.

## Hasil dan batas

Pembaruan berikutnya 15 September 2026: [BRAND_FOOTER_REDESIGN.md](BRAND_FOOTER_REDESIGN.md) mencatat wordmark dua baris, footer minimalis, grup tema lebih tenang dan bukti build/QA terbaru. Banner contoh tetap hanya di wrapper. Hasil pemulihan berikut merupakan riwayat sebelum perubahan wordmark/footer.

### Pemulihan sesi 15 September 2026

- Riwayat dan file checkpoint diperiksa: sembilan WebP contoh terbaca, JSON bukti lama dapat diparse dan tidak memiliki assertion gagal. Tidak ditemukan tanda file terpotong pada file yang diperiksa; ini bukan pemeriksaan forensik seluruh disk.
- Preview 4431/4432/4433 semula tidak berjalan, sekarang dijalankan kembali dari `work/sample-preview.mjs`. URL pemilik tetap http://127.0.0.1:4433/. Data contoh tidak ditambahkan ke app/public atau database.
- Saat turn diputus, npm test tetap berjalan di background dan menghasilkan build baru `VDl2fdZzTCKRkhwPbiLFo`. Output final proses itu tidak diterima, sehingga tidak diklaim sebagai full gate baru yang terbukti. Setelah proses tersebut selesai, suite fondasi 7/7, kontrak 8/8, rendered 38/38 dan browser 5/5 dijalankan ulang dan hasilnya diterima PASS. Lint/typecheck serta diff-check PASS. Preview produksi menggunakan build tersebut.
- Matriks browser diulang pada enam halaman, light/dark, CSS 360/390/768/1024/1440: 60/60 PASS. Bukti baru `output/playwright/resume15-sample-matrix.json`; 24 screenshot `resume15-sample-final-*`. Ini terpisah dari bukti tanggal 14.
- Alur wrapper contoh diulang: 13/13 PASS, hasil `resume15-sample-review-results.json`. Pencarian, detail, return/reset, direktori/profil/aset, semua gambar lokal dan WhatsApp nonaktif diperiksa ulang. Screenshot `resume15-sample-review-*`.
- Skrip QA semula menghitung DOM sebelum navigasi selesai dan memakai scroll cepat untuk lazy images dalam iframe. Koreksi hanya pada `work/sample-review-check.js`: tunggu hasil terlihat/aria-busy selesai, scroll tiap foto ke tengah dan tunggu load. Satu capture screenshot timeout saat browser sibuk; run akhir lengkap lolos. Tidak mengubah kode aplikasi untuk meloloskan tes.
- Skill Playwright digunakan untuk pemeriksaan browser dan screenshot; tidak ada pengubahan visual aplikasi pada pemulihan ini. Tidak mengunduh ulang media yang sudah utuh, tidak menghapus perubahan pengguna, tidak commit/push/deploy atau mengirim WhatsApp. Batas integrasi asli/perangkat fisik/penilaian visual pemilik tetap terbuka.

Implementasi kontrol dan verifikasi lokal selesai. Tidak ditemukan blocker pada alur yang diuji. Ini bukan klaim kesempurnaan, integrasi data asli, atau kesiapan peluncuran nasional. API asli 4410 belum tersedia; pengujian menggunakan fixture lokal terisolasi. Tidak ada commit, push, deploy, migrasi, perubahan backend/data produksi, atau pengiriman WhatsApp. Perubahan pengguna yang sudah ada tetap dipertahankan.

## Komponen yang berubah

- `ThemeControl`: pilihan Terang/Gelap/Ikuti perangkat berupa tiga ikon satu klik, indikator bergeser 180ms, label aksesibel, tooltip, radio keyboard. Default sistem, penyimpanan lokal, bootstrap first-paint dan pergantian tema perangkat dipertahankan. Reduced motion meniadakan gerak.
- `SearchField`: ikon pencarian, tombol hapus terintegrasi, focus ring pada bidang. Pencarian beranda/katalog menyatu dengan tombol Cari aset; tetap satu baris di ponsel. Pencarian direktori memakai komponen yang sama.
- Jenis aset: radio tile dengan ikon, semua jenis dan grid kategori dari taksonomi asli; bukan native dropdown atau daftar kategori tebakan.
- Provinsi: autocomplete custom, mendukung saran serta provinsi yang diketik. Saran hanya berasal dari aset pada halaman, bukan klaim daftar seluruh provinsi.
- BPRS: popup React Aria dengan bidang logo tetap, nama/lokasi membungkus, check terpisah, satu area scroll. Pilihan sementara tidak mengubah URL sebelum Tampilkan hasil. Teks BPRS yang tidak cocok dengan pilihan mencegah pengiriman filter yang salah.
- `ControlSelect`: popup urutan Terbaru/Terlama custom dengan keyboard. Tidak menambah opsi backend.
- Scrollbar memakai token tema dan tetap native: tidak ada scroll hijacking atau library scroll tambahan. Tampilan scrollbar dapat berbeda menurut browser/OS.
- Footer: tulisan persis “Katalog publik · tanpa akun” dihapus. Kartu, status, kontak publikasi dan alur detail tidak diganti dengan quick-view atau alur transaksi.

CSS kontrol baru menggunakan module terisolasi (`CatalogControls.module.css`/`ThemeControl.module.css`) agar tidak kembali terkena selector editorial lama. Tidak menambah dependency. React Aria dan Radix sudah tersedia. Portal picker mobile mengikuti container Dialog melalui UNSAFE_PortalProvider yang tersedia pada versi terpasang; integrasi ini harus diuji kembali ketika dependency diupgrade.

## Temuan yang diperbaiki dan diuji ulang

1. Popup BPRS sempit, teks terpotong dan dua scrollbar pada screenshot pengguna: lebar popup terpisah dari input, grid logo/teks/check eksplisit, scroll hanya pada list.
2. Popup custom awal di mobile keluar viewport/tidak menerima pointer karena portal di luar Dialog: container portal dipindah ke panel, pointer events dipulihkan.
3. Escape awal menutup panel sekaligus atau membuka kembali picker karena commit nilai: picker menutup tanpa commit melalui state toggle; Escape pertama menutup pilihan, Escape berikutnya panel. Fokus kembali ke pemicu.
4. Nama aksesibel select terduplikasi dan placeholder terlalu panjang: label tunggal, placeholder singkat.
5. Typecheck awal menemukan import ikon dan markUrl opsional: diperbaiki; lint/typecheck/build berikutnya lolos.
6. Dua tes source mengunci copy lama: diperbarui sesuai copy baru, tanpa menghapus verifikasi draft atau reset.
7. Harness perjalanan lama mengira province masih datalist dan judul katalog sebagai detail sebelum navigasi selesai: dipindah ke interaksi option dan waitForURL. Run ulang 34/34 lolos. Harness mobile juga menyesuaikan nama “02 Daftar BPRS”. Ini koreksi harness, bukan mengabaikan kegagalan.
8. Satu sumber logo BSI merespons HTTP 522: diganti sumber yang berhasil diambil. Favicon wrapper lokal semula 404: diarahkan ke icon.svg aplikasi, diperiksa ulang.

## Verifikasi aktual setelah perubahan

Build produksi: `vg6rpJ_hfabuC_hsYNhoJ`.

Setelah bukti disimpan, browser QA controls dan fixture produksi sementara 63169 dihentikan secara spesifik. Preview contoh 4433/4432 tetap aktif untuk pemilik; API contoh 4431 hanya memori. Dev 4411 dan runtime lama yang tidak dimiliki langkah QA ini tidak dihentikan massal. Final HTTP wrapper/katalog contoh 200; favicon wrapper 200 setelah redirect.

| Pemeriksaan | Hasil |
| --- | --- |
| npm run lint / npm run typecheck / git diff --check | PASS |
| npm test: kontrak / fondasi / production build / rendered | 8 / 7 / PASS / 38 PASS |
| npm run test:browser (Chromium, suite repository) | 5/5 PASS |
| Kontrol: dropdown, draft, kombinasi, chip, reset, input bebas, Escape, tema | 192/192 development; 192/192 produksi |
| Konteks katalog, Back/Forward, scroll return, pagination, retry | 18/18 produksi |
| Beranda/search/category/detail/WA URL/tema/device/reduced/kontak rusak | 34/34 produksi |
| Menu/filter/galeri keyboard, zoom foto, focus trap/restore, offline/CTA | 122/122 produksi |
| Marquee arah kanan, pause/resume, fokus, clone Tab, reduced | 24/24 produksi |
| Edge: parsial, satu foto, foto/logo rusak, nama panjang, nol aset, error, hover | 18/18 produksi |
| First paint dan reload, 3 preferensi x 2 tema perangkat | 6/6 produksi |
| 6 route x 5 lebar CSS x 2 tema, fixture standar | 60/60 view |
| 6 route x 5 lebar CSS x 2 tema, foto/logo contoh | 60/60 view |
| Preview berlabel, search/detail/return/direktori/profil, media lokal, WA nonaktif | 13/13 |

Lebar CSS diukur dari innerWidth: 360, 390, 768, 1024, 1440. Screenshot full-page dapat diperkecil oleh viewer; ukuran tidak disimpulkan dari gambar yang diperkecil. Matriks memeriksa tema, h1, nested interaksi, overflow horizontal, error console, foto tanpa filter/fallback tak terduga, dan font lokal. Animasi diuji terpisah dengan no-preference; screenshot matriks memakai reduced motion. Status/kontak tidak valid menampilkan keadaan sesuai kontrak, bukan link palsu. Tidak ada WhatsApp yang dikirim.

JSON bukti: `output/playwright/controls-{prod,flows,journeys,keyboard,motion,edge,theme-paint}-results.json`, `controls-final-matrix.json`, `sample-final-matrix.json`, `sample-review-results.json`. Bukti development: `controls-dev-results.json`. Angka di atas adalah assertion yang dirinci, bukan jumlah pengguna/perangkat fisik.

## Preview contoh yang dapat ditinjau

**Buka http://127.0.0.1:4433/**. Wrapper selalu menampilkan SIMULASI LOKAL; iframe mengikuti lebar browser, tanpa scrollbar wrapper tambahan. Semua route tetap dapat ditelusuri. WhatsApp dinonaktifkan dalam data simulasi dan popup eksternal tidak diizinkan oleh wrapper.

Lima contoh aset, empat contoh logo (BCA, Bank Indonesia, BSI, BRI). **Logo ini bukan daftar BPRS/mitra Seputarjaminan. Bank Indonesia bukan BPRS.** Nama diberi “contoh logo”, profil/deskripsi menyatakan simulasi. Kota, spesifikasi, status dan hubungan penerbit bukan data riil. Dua foto galeri contoh rumah menunjukkan properti berbeda untuk menguji layout, bukan dokumentasi satu aset. Empat logo pada desktop statis bila belum memenuhi baris; rail dapat bergerak pada lebar yang lebih kecil. Fixture sembilan BPRS digunakan terpisah untuk uji marquee desktop.

Jalankan ulang dari repository (tidak mengubah .env):

```powershell
node work/prepare-sample-media.mjs
npm run build
node work/sample-preview.mjs
```

Pastikan port 4431/4432/4433 kosong. Jangan rebuild saat preview produksi masih menyajikan build lama; hentikan proses preview ini dahulu. Script hanya bind 127.0.0.1: API contoh 4431, Next production 4432, wrapper review 4433. API contoh hanya GET dan in-memory, tanpa database atau API asli. Untuk berhenti gunakan Ctrl+C pada proses script. Untuk menghapus contoh nanti, hentikan preview lalu hapus hanya `work/sample-{sources.mjs,taxonomy.json,preview.mjs,matrix.js,review-check.js}`, `work/prepare-sample-media.mjs`, dan `output/local-sample-media/` setelah konfirmasi. Tidak perlu menyunting kode aplikasi atau data produksi. Screenshot/dokumen bukti boleh dipertahankan.

Foto/logo disimpan hanya di `output/local-sample-media/` (9 WebP, total sekitar 1.2 MB), tidak dalam `public/`, tidak diimpor app, tidak menjadi fallback saat API gagal. Browser preview mengambil media same-origin lokal. Optimasi ukuran/format tanpa filter warna atau distorsi. Manifest sumber/atribusi ada di `work/sample-sources.mjs`. Logo dilindungi merek pemilik masing-masing; sumber contoh bukan izin publikasi produksi. Gunakan materi BPRS berizin sebelum peluncuran.

## Screenshot representatif

Semua contoh pada tautan berikut simulasi, bukan data nyata:

- [Beranda desktop](output/playwright/sample-review-home-desktop.png)
- [Katalog desktop terang](output/playwright/sample-review-catalog-light-1440.png)
- [Katalog mobile gelap](output/playwright/sample-review-catalog-dark-390.png)
- [Popup BPRS mobile gelap](output/playwright/sample-review-popup-mobile-dark.png)
- [Menu dan tema mobile](output/playwright/sample-review-menu-mobile-dark.png)
- [Detail desktop terang](output/playwright/sample-final-detail-light-1440.png)
- [Direktori desktop gelap](output/playwright/sample-final-directory-dark-1440.png)
- [Profil mobile terang](output/playwright/sample-final-profile-light-390.png)

Seluruh enam halaman tersedia dalam `sample-final-{home,catalog,detail,directory,profile,help}-{light,dark}-{390,1440}.png`. Full-page detail menampilkan CTA fixed pada posisi viewport saat capture; periksa interaksi scroll pada preview untuk clearance sebenarnya.

## Batas yang tetap terbuka

- Integrasi API/data/foto/logo/nomor publikasi asli belum dapat disahkan. Preview ini menguji frontend, bukan akurasi database nasional.
- Firefox/WebKit, perangkat fisik, keyboard virtual, screen reader, zoom browser fisik, kondisi jaringan lapangan dan uji pengguna awam belum diuji pada perubahan ini. Zoom foto dan keyboard Chromium sudah diuji.
- Logo ber-wordmark sangat panjang tetap kecil pada slot kartu 40px; nama institusi di sampingnya menjadi identitas terbaca. Gunakan logo dengan whitespace seimbang/mark ringkas yang disetujui BPRS; jangan stretch atau invert logo.
- Kode CSS legacy campuran tetap ada sebagai baseline; selector kontrol baru memakai module. Tidak melakukan penghapusan massal file pengguna.
- Hasil visual akhir tetap memerlukan review pemilik dengan konten berizin yang akan dipublikasikan. Tidak menggunakan kata “sempurna” sebagai pengganti bukti.
