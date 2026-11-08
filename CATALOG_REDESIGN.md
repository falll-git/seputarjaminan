# Tahap 5 — katalog

## Perilaku yang dikunci

- Heading ringkas “Katalog aset”; pencarian, filter, jumlah halaman, dan kartu menjadi prioritas. CSS module katalog tidak mengubah susunan route lain. Grid 1/2/3 kolom sesuai viewport, kartu dibatasi 450px meskipun hasil hanya satu.
- Filter desktop dan mobile menggunakan **draft yang sama**: ubah Jenis aset, Provinsi aset, BPRS → Tampilkan hasil. Atur ulang di form hanya mengosongkan draft; Tampilkan hasil mengirimnya. Tutup/Escape mobile membuang draft. Copy menjelaskan pilihan belum diterapkan; tidak ada hitungan hasil tebakan di tombol.
- Pencarian dikirim dengan tombol/Enter. Urutan Terbaru/Terlama tetap sesuai NEWEST/OLDEST API. Perubahan pencarian, chip, atau pengurutan langsung meminta hasil; permintaan menampilkan “Memuat hasil…” dan aria-busy. Filter memakai satu submit sehingga kombinasi tidak bergantung beberapa navigasi bersamaan.
- Provinsi hanya disarankan dari lokasi aset halaman dan provinsi aktif. **Lokasi kantor BPRS tidak lagi menjadi opsi lokasi aset.** Karena API tidak menyediakan facet provinsi lengkap, input menerima provinsi lain yang diketik; bantuan menyatakan keterbatasan saran. Kota/lokasi bebas tetap dapat dicari dalam pencarian sesuai kemampuan API.
- BPRS memakai daftar profil publik yang sudah ada. Nama hasil ketikan harus dipilih dari combobox, bukan dikirim sebagai slug rekaan. Gangguan taxonomy/daftar BPRS diberi pesan; filter lain tetap ada.
- Chip aktif berasal dari URL yang diterapkan (q/category/province/bprs), bukan draft. Masing-masing dapat dihapus. Reset filter mempertahankan pencarian/pengurutan; Hapus semua/Atur ulang pencarian kembali ke `/katalog`.
- Jumlah adalah **N aset ditampilkan pada halaman ini**, bukan total kecocokan di server. Error menampilkan “Jumlah aset belum tersedia”, bukan 0 hasil. Katalog kosong, tidak ada kecocokan, halaman cursor kosong, dan gagal/timeout dibedakan dengan reset/halaman pertama/retry yang sesuai. Pencarian/filter tetap tersedia ketika pengambilan aset gagal.
- Pagination manual `next_cursor` dipertahankan; tautan berikut mengganti halaman, tidak menambah infinite scroll. Semua kriteria tetap dalam URL. Perubahan kriteria menghapus cursor. Tautan kembali ke halaman pertama tersedia pada halaman cursor.

## Kembali dari detail

- Kartu memakai Next Link tanpa prefetch otomatis. Foto, judul, CTA memakai satu URL detail dengan parameter `returnTo` berisi konteks katalog. BPRS tetap link terpisah.
- `safeCatalogReturn` hanya menerima pathname `/katalog` dari origin lokal dengan allowlist q/category/province/bprs/sort/cursor; external URL dan path lain jatuh ke `/katalog`. Bukan open redirect.
- Next mempertahankan Back/Forward. Tombol Kembali ke katalog menggunakan `CatalogReturnLink`, juga pada error detail. Konteks tetap tersedia setelah reload detail dan pada URL yang dibuka langsung; tidak menebak halaman sebelumnya melalui referrer.
- Scroll saat keluar dari kartu dicatat di sessionStorage tab, beserta URL dan waktu. Klik kembali meminta restore setelah DOM katalog siap; TTL 30 menit. Storage gagal/invalid tidak menyebabkan error dan URL tetap bekerja, tetapi pemulihan scroll eksplisit tanpa storage belum dijamin. Tidak menyimpan data internal atau kontak.
- Perubahan detail tahap ini terbatas pada tautan kembali/error detail untuk kebutuhan katalog. Tahap 6 galeri/WhatsApp belum dikerjakan.

## Sumber dan verifikasi

File inti: `app/katalog/page.tsx`, `app/katalog/catalog.module.css`, `CatalogClient.tsx`, `AssetCard.tsx`, `CatalogReturnLink.tsx`, `app/lib/catalog-navigation.ts`, `app/aset/[slug]/page.tsx`. Komponen kartu/tema tahap 2–4 dipakai ulang. Tidak mengubah backend, kontrak API, dependency, environment atau produksi.

Tes render menjaga markup/filter/chip, tiga URL detail identik, returnTo dan penolakan external return URL, jumlah halaman serta error/empty. Harness mendapat skenario `__pagination__` khusus fixture: dua item per halaman, cursor fixture-page-2. Ini tidak ditambahkan ke aplikasi atau API publik.

Playwright CLI: `work/stage5-qa.js` dan `work/stage5-edge-qa.js`, URL fixture ephemeral harus diperbarui saat dijalankan lagi. Screenshot `output/playwright/stage5-*.png`. Hasil final ada di REDESIGN_PROGRESS.md.

## Keterbatasan

Upstream 4410 belum aktif; QA memakai fixture terisolasi 5 aset/5 BPRS/3 media serta dataset kosong. Pagination sintetis membuktikan perilaku UI, bukan kebenaran cursor database. Sorting diuji pada URL/API mapping, bukan urutan database nyata karena fixture tidak mengurutkan data. Foto sintetis bukan bukti kualitas foto/semua kategori. Performa dataset besar, Safari/Firefox/perangkat fisik, storage-blocked scroll dan uji pengguna awam tetap terbuka.
