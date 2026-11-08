# Tahap 9 — audit visual dan perbaikan

Tanggal: 14 September 2026. Status: audit tahap 9 dan perbaikan lokal selesai; batas integrasi/perangkat tetap dicatat di bawah.

## Ringkasan dan batas pekerjaan

Audit dan perbaikan hanya frontend publik repository terkonfirmasi `D:\seputarjaminan-production`. Perubahan pre-existing pengguna tetap dipertahankan. Tidak ada perubahan API/schema, database, konfigurasi WhatsApp, data produksi, dependency, commit, push, atau deployment.

Aplikasi/API asli 4411/4410 tidak sedang melayani dataset saat audit dimulai. Pengujian memakai build aplikasi aktual + upstream fixture pada port loopback ephemeral; bukan publikasi produksi. Development preview hanya untuk specimen, dilindungi `NODE_ENV === development` dan noindex. Skill Playwright dipakai untuk mengukur browser nyata dan menyimpan screenshot; pemeriksaan visual tidak digantikan hasil build.

## Cakupan dan cara ukur

- Matriks **31 route/kondisi × 2 tema × 5 lebar = 310 view**.
- Lebar wajib **360, 390, 768, 1024, 1440 CSS px**, tinggi 900. Setiap baris JSON merekam `innerWidth`, `clientWidth`, `scrollWidth`, DPR, `visualViewport.scale`, dan tema. Semua sesuai sasaran; DPR 1 dan scale 1 pada matriks utama.
- Pemeriksaan DOM otomatis di seluruh matriks, disertai review screenshot representatif, bukan klaim semua screenshot diperiksa manual satu per satu.
- 60 view keyboard pada enam jalur utama, semua pasangan tema/lebar: **1.412 perpindahan Tab**, tanpa target tersembunyi, focus ring hilang, atau fokus tertutup header/CTA setelah perbaikan.
- **122 pemeriksaan interaksi** menu/filter/galeri/offline/WhatsApp pada viewport height 650. Galeri juga diuji Tab dan Shift+Tab.
- **18 pemeriksaan alur** pada desktop light dan mobile dark: search/sort, chip, reset, Back/Forward, pagination manual, kembali detail dengan posisi scroll, retry, direktori → profil → detail → href WhatsApp.
- **26 pemeriksaan zoom/touch**: 24 view reflow pendek (720 atau 360 CSS px × 450, DPR 2) + swipe PhotoSwipe + pembesaran visual viewport mobile 2×. Ini emulasi reflow 200%/pembesaran browser engine, **bukan** pengujian tombol zoom native atau perangkat fisik.
- 10 kombinasi tema/lebar specimen: portrait 900×1600, landscape 1600×900, foto kosong/gagal, spesifikasi bangunan/kendaraan/mesin, logo lebar/tinggi/transparan/putih. Manrope dan Source Sans 3 terkonfirmasi `loaded`.
- 10 streaming loading katalog, serta screenshot skeleton lima jenis halaman × seluruh tema/lebar.
- Pemeriksaan terakhir khusus galeri sesudah perubahan CSS lokalnya mencakup seluruh 10 pasangan tema/lebar; lihat berkas `stage9-gallery-final.json`.

### Peta kondisi matriks

| Kelompok | Kondisi |
| --- | --- |
| Beranda | Banyak, satu dengan judul panjang, kosong, upstream error |
| Katalog | Normal, satu/long, kosong, tanpa kecocokan, error, foto gagal |
| Detail | Normal/multi foto, long, parsial, satu foto, foto gagal, kontak hilang, upstream error, status nonpublik/404 |
| BPRS | Direktori normal/kosong/no-results/error/logo gagal; profil normal/long/nol aset/error profil/error daftar aset/not-found |
| Bantuan dan sistem | Cara menghubungi, general 404, loading, offline, menu, filter, PhotoSwipe |

## Temuan dan penyelesaian

| ID | Temuan berdasarkan bukti | Perbaikan dan uji ulang |
| --- | --- | --- |
| V9-01 | Halaman error detail/profil hanya memiliki h2, tanpa heading utama. | `PublicDataState.headingLevel` digunakan sebagai h1 hanya pada state halaman. Semua 310 view menetap memiliki satu h1. |
| V9-02 | Skeleton katalog lama berbeda jauh dari susunan final: heading 390 px x64/y140/h84, sidebar/media generik. Profil belum punya loading khusus. | Skeleton per home/catalog/detail/directory/profile; tambah loading profil. Heading katalog kini sama persis x16/y85/h33.59 pada mobile. Foto skeleton 358×268.5 sama dengan hasil 390 px; posisi awal katalog tanpa chip berbeda sekitar 4 px (405 vs 401), desktop sekitar 1.55 px. |
| V9-03 | Fokus thumbnail, profil dan kartu terkait tertutup CTA mobile ketika Tab. | Ukur tinggi dock dengan ResizeObserver; scroll-padding atas/bawah mengikuti header dan tinggi CTA. 60 view/1.412 Tab lulus; reflow pendek juga lulus. |
| V9-04 | Inline object-fit cover menimpa maksud galeri contain sehingga portrait terpotong. | Galeri utama secara eksplisit memakai contain. Kartu tetap cover agar konsisten; galeri specimen menampilkan portrait utuh, tanpa filter warna. |
| V9-05 | Sumber foto kosong memakai pesan sama dengan kegagalan pemuatan. | Bedakan “Foto aset belum tersedia” dan “Foto aset belum dapat dimuat”; logo tetap placeholder tersendiri. Metadata invalid tetap ditangani sesuai kontrak. |
| V9-06 | Notifikasi offline 390 px y791–886 menutupi dock WhatsApp y779–900. | Notifikasi ditempatkan di atas tinggi dock aktual; ukur tinggi notifikasi, sediakan spacer dan scroll clearance; cleanup saat online/unmount. Uji offline/online semua 10 view lulus tanpa overlap CTA. |
| V9-07 | Tab setelah kontrol terakhir PhotoSwipe sempat keluar ke browser chrome/body. Dialog juga belum bernama. | Siklus Tab/Shift+Tab eksplisit hanya pada kontrol tampak, aria-modal dan nama galeri. Escape mengembalikan fokus ke slide aktif. |
| V9-08 | Panah berikutnya terbalik dua kali: SVG custom dan CSS bawaan PhotoSwipe. Ukuran SVG bawaan 60 px juga melebihi tombol baru. | Hilangkan flip CSS kedua; ikon 32 px terpusat dalam tombol 54×64. Periksa arah secara visual dan bounding rect ikon, bukan sekadar jumlah tombol. |
| V9-09 | Ikon putih dan caption tanpa bidang solid nyaris hilang di atas foto terang saat zoom. | Toolbar, tombol dan caption memakai token bidang media solid, focus ring terlihat, teks caption bisa membungkus. Foto tidak diubah warnanya. |

Tidak mengubah urutan halaman, menambahkan quick view, harga, jadwal, bidding, login, formulir lead, status rekaan, atau nomor WhatsApp global.

## Detail teknis dan hasil verifikasi

Perubahan aplikasi dibatasi pada `PublicDataState`, `PublicLoadingState` + CSS module, loading profil, pemanggil error detail/profil, `PublicMedia`, `AssetContact`, `ConnectivityNotice`, `AssetDetailGallery`, serta aturan terkait di foundation/system-states/routes CSS. Development fixture di `app/dev/design-system/VisualAuditPreview.tsx`; bukan impor halaman publik.

Quality gate yang dijalankan:
- `npm test`: kontrak 8, foundation 7 (termasuk regression guard tahap 9), production build/TypeScript, rendered 38.
- Existing Playwright browser suite 5 tes.
- ESLint terarah `app tests/design-foundation.test.mjs tests/rendered-html.test.mjs tests/browser/public-site.spec.ts`.
- `npm run typecheck`, `git -c core.safecrlf=false diff --check`.
- Seluruh gate di atas PASS pada source akhir (8 kontrak, 7 foundation, 38 rendered, build/TS, browser 5/5, lint terarah). Full matrix dijalankan ulang setelah perbaikan inti; perubahan CSS terakhir hanya pada PhotoSwipe diuji ulang pada seluruh 10 pasangan tema/lebar, termasuk geometri ikon dan Tab dua arah. Tambahan keyboard murni tanpa pointer pada 360×450 light/dark lulus. Tidak mengklaim full matrix dijalankan lagi sesudah aturan khusus overlay terakhir itu.
- 340 PNG diperiksa signature, checksum setiap chunk, dan IEND: tidak ditemukan file invalid. SHA-256 17 file source terkait disimpan di stage9-integrity.json. Ini bukti integritas saat handoff, bukan klaim tidak mungkin ada bug logika.

### Kejujuran alat dan pengulangan

1. Detektor awal `scrollHeight > clientHeight` menandai ink font dengan overflow visible sebagai “clipped”. Tidak mengubah heading untuk mengejar angka. Detektor diperketat ke overflow hidden/clip, lalu dikonfirmasi lewat screenshot.
2. Pola intersepsi awal `**/media/*` ikut menangkap font `/_next/static/media`. Ini kesalahan harness browser, **bukan file font corrupt**. Intersepsi dibatasi ke `http://127.0.0.1:4411/media/*`; seluruh 10 specimen dibuat ulang, kedua font loaded. Bukti final memakai hasil ulang.
3. Klik locator otomatis pada header sticky men-scroll halaman ke 0. Klik koordinat pusat tombol yang diukur mempertahankan y200 saat buka, 12 Tab, dan Escape. Bukan bug aplikasi; tidak menambah kode pengunci scroll palsu.
4. Selector `institution=` salah untuk URL UI yang memakai `bprs=`; serta nama link “Lihat profil” berbeda dari accessible name “Buka profil”. Diperbaiki di harness, tanpa mengubah kontrak aplikasi.
5. Streaming SSR sempat menghasilkan duplikat node hidden pada query CSS galeri. Query diarahkan ke slide yang visible. Runner terkait diulang lengkap.
6. Server fixture selalu dihentikan sebelum rebuild; hasil dari build sebelum perubahan terakhir tidak dipakai untuk membuktikan perbaikan galeri terakhir.
7. Console 404/503 pada case media/error disengaja. Tidak ada pageerror pada matriks utama. Preview development dapat memberi warning reduced-motion, preload/LCP akibat scroll otomatis; itu tidak dihitung kegagalan produksi.

## Bukti yang disimpan

Lihat [indeks bukti visual](output/playwright/STAGE9_EVIDENCE.md).

- `stage9-matrix-before.json` dan `stage9-matrix-after.json`: baseline dan hasil 310 view.
- `stage9-focus-before.json` / `stage9-focus-after.json`: fokus.
- `stage9-specimens-after.json`, `stage9-loading-after.json`: media/font/skeleton.
- `stage9-interactions-after.json`, `stage9-flows-after.json`, `stage9-zoom-touch-after.json`: perilaku.
- `stage9-gallery-final.json`: koreksi terakhir kontrol galeri.
- `stage9-*.png`: bukti sebelum/sesudah. “baseline”, “before”, dan “gallery-zoom” bukan bukti akhir perbaikan kontrol; gunakan **gallery-final**.
- Skrip CLI reproducible di `work/stage9-*.js` (lokal, folder work memang di-ignore repository). Port fixture ephemeral dalam skrip harus disesuaikan saat reproduksi.
- Fixture server: `SJ_VISUAL_FIXTURE_HOLD=true`, count 5/9/3 untuk aset/BPRS/media; varian normal/long/error, ditambah 0/0 untuk kosong. Jalankan existing `node --test --test-name-pattern='homepage merender state' tests/rendered-html.test.mjs`; tunggu `VISUAL_FIXTURE_READY`.

## Keterbatasan yang tetap terbuka

- Data asli dan upstream 4410 belum diverifikasi hidup. Fixture awal menggunakan WebP bidang warna, bukan fotografi aset/BPRS nyata. Specimen SVG hanya menguji bentuk/komposisi; tidak membuktikan kualitas foto dan keseimbangan optis setiap logo produksi.
- Specimen spesifikasi kartu menguji prop komponen. DTO daftar publik tidak selalu menyediakan spesifikasi; jangan menambahkan angka palsu ke kartu produksi.
- Public contract hanya menerbitkan AVAILABLE; status tidak aktif menjadi not-found. WhatsApp hilang yang ditolak validator menghasilkan error detail; nomor invalid yang lolos bentuk DTO menghasilkan kontak disabled. Tidak mengarang state publik baru.
- Pagination fixture membuktikan perpindahan cursor dan konteks, bukan ketepatan sorting database atau performa volume besar.
- Skeleton initial route belum tahu panjang judul asli, jumlah hasil, atau chip URL. Chip yang muncul setelah respons deep link dapat menambah 56–107 px pada kasus query uji; navigasi filter yang sudah aktif tetap memakai konteks existing. Tidak mengarang hitungan untuk menutup selisih. Ini bukan klaim CLS nol atau benchmark performa produksi.
- Belum ada uji Firefox/WebKit, screen reader nyata, native browser zoom menu, keyboard virtual/perangkat fisik/notch, atau uji pengguna awam. Pengujian Playwright Chromium dan emulasi tidak menggantikannya.
- Audit tahap 9 lokal tidak berarti seluruh website siap deployment atau bebas semua kemungkinan bug.
