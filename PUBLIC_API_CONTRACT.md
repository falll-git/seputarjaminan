# OPS-03 — kontrak API publik dan frontend

Verifikasi terakhir: 16 September 2026, lokal. Ini bukan persetujuan deployment
atau pernyataan seluruh operasional SJ selesai. Visual yang disetujui dipertahankan.

## Peta kontrak

| Kontrol/alur | Sumber | Perilaku |
| --- | --- | --- |
| Daftar, pencarian, kategori | `GET /v1/public/assets` | `q`, category/subcategory taxonomy, province, city_regency, institution; AND antar-filter |
| Urutan | endpoint daftar aset | NEWEST/OLDEST; `public_updated_at` lalu UUID searah sebagai pemecah nilai sama |
| Halaman berikutnya | `next_cursor` | Cursor opaque versi 1 terikat filter/urutan, tidak terikat limit; limit 1–100, default 24 |
| Pilihan kategori | `GET /v1/public/taxonomy` | Kategori/subkategori/vocabulary V1 yang benar-benar didukung |
| Direktori | `GET /v1/public/institutions` | q/province, cursor berdasarkan slug menaik; BPRS aktif dengan aset eligible |
| Profil | `GET /v1/public/institutions/:slug` | Profil aktif; boleh nol aset; jumlah aset eligible berasal dari server |
| Pilihan BPRS katalog | `GET /api/public/institutions` pada website | BFF fixed upstream, 20 opsi per permintaan; q/cursor existing API, tanpa enumerasi seluruh direktori |
| Detail | `GET /v1/public/assets/:referenceCode` | DTO publik, atribut kategori, galeri READY, kontak publikasi |
| Media | `/media/:id` website → `/v1/public/media/:id` | Media READY/delivery publik; logo juga mensyaratkan instansi aktif |
| Hubungi BPRS | whatsapp_url dari detail | Nomor konfigurasi publikasi; frontend menambahkan nama/kode dan URL lingkungan tanpa returnTo/filter |

Tidak ada total global hasil katalog/direktori. Jumlah di katalog adalah panjang
halaman yang diterima. `published_asset_count` merupakan hitungan aset eligible
untuk satu BPRS, bukan total direktori. Profil → katalog boleh berpindah ukuran
halaman dengan cursor yang sama selama filter dan urutan tetap sama.

## Validasi dan eligibility

- API menolak parameter tidak dikenal, duplikat/array, kosong, terlalu panjang,
  limit/sort tidak valid, dan pasangan kategori/subkategori tidak cocok dengan 400.
- Cursor tidak valid, rusak, versi lama, atau milik filter/urutan lain menghasilkan
  `CURSOR_INVALID`; tidak dianggap halaman pertama. Tautan cursor sebelum perubahan
  ini perlu dimulai ulang. Cursor bukan credential/signature keamanan.
- URL website menggunakan kategori slug, bprs, terbaru/terlama. Parameter salah
  menghasilkan state pemulihan dengan tindakan atur ulang, bukan hasil tanpa filter.
- Provinsi/kota: NFKC, trim, whitespace berulang dirapatkan, perbandingan database
  tidak membedakan kapitalisasi. Ini bukan fuzzy matching atau tabel alias wilayah:
  ejaan berbeda/alias tetap dapat menghasilkan nol hasil. Data sumber tidak diubah.
- Eligibility tetap PUBLISHED, AVAILABLE, reconfirmation belum kedaluwarsa,
  instansi/profil ACTIVE, kontak VERIFIED, dan cover READY. Tidak ada status baru,
  fallback kontak global, atau pelonggaran status/media untuk melayani contoh UI.
- DTO dibentuk eksplisit. Website menolak field tambahan pada list, card, detail,
  media, identitas/lokasi, atribut, dan taxonomy; atribut hanya sesuai kategori.
  Data internal seperti source ID, payload checksum, storage key, nama legal internal,
  dan nomor kontak sebagai field terpisah tidak diteruskan.

## Spesifikasi kartu

`summary_attributes` opsional dan maksimal dua atribut publik yang sudah ada:

| Kategori | Atribut ringkas |
| --- | --- |
| Tanah | land_area_m2 |
| Bangunan | land_area_m2, building_area_m2 |
| Mesin/peralatan | brand_or_manufacturer, model_or_type |
| Kendaraan | model_or_type, mileage_km |

Tidak ada lookup detail per kartu. Relasi kategori sudah tersedia pada query list;
angka sah seperti mileage 0 tetap dipetakan menjadi `0 km`. Detail tetap menyajikan
atribut publik lengkap sesuai kategorinya. Tidak ada atribut harga/jadwal baru.

## Pilihan BPRS

SSR mengambil satu halaman 20 opsi dan, bila diperlukan, satu profil untuk label
BPRS terpilih di luar halaman awal. Pencarian browser debounce 250 ms, permintaan
lama dibatalkan/diabaikan, batas waktu 8 detik. Muat halaman berikutnya hanya melalui
tombol, bukan loop atau infinite scroll. Kegagalan menyediakan retry dan dibedakan
dari nol hasil. Pilihan draft belum mengubah filter aktif sampai Tampilkan hasil.

Tidak ada library baru. Export `@seputarjaminan/contracts/public-constants` memisahkan
konstanta publik dari validator filesystem agar aman untuk bundel Next.

## Bukti pengujian

- PASS: unit 60 (kontrak8, API32, worker4, config13, storage3).
- PASS: kontrol/pemetaan frontend3, konfigurasi lokal17, fondasi desain7.
- PASS: rendered HTML40, browser Chromium existing5; production build, root/API
  typecheck, lint, generated OpenAPI `--check`, dan checksum migration14.
- PASS: empat kelompok read-only dengan role public nyata, tanpa superuser/BYPASSRLS,
  pada DB Docker terisolasi OPS-02. 7.220 aset eligible, 73 halaman per urutan
  NEWEST/OLDEST tanpa duplikat/terlewat; direktori190 BPRS/10halaman; 25 detail
  ineligible ditolak; filter gabungan, normalisasi, cursor mismatch, DTO dan logo
  instansi suspended. Dataset asal 10.000 publikasi/200 instansi.
- PASS: fingerprint 29 tabel database workflow lama tetap sama; tidak ada mutasi.
- Pemeriksaan interaktif: 1440px desktop/390px mobile, light/dark, BPRS di luar
  20 opsi awal, keyboard pilih, load-more, error/retry, respons terlambat, Escape
  bertingkat dan fokus kembali, kombinasi filter, chip hapus, detail/kembali/reload,
  tema tetap tersimpan, tidak ada horizontal overflow pada viewport diperiksa.
- WhatsApp: inspeksi href saja; tidak mengirim pesan atau membuka pihak luar.
  Console normal setelah reload: 0 error/warning. Dua 503 pada tes kegagalan sengaja
  dihasilkan dan tidak dihitung sebagai kesalahan aplikasi normal.

Evidence/checkpoint lokal ignored: `work/ops-03/`; screenshot
`output/playwright/ops03/mobile-picker-light.png` dan
`output/playwright/ops03/desktop-filtered-dark.png`. Bukan kandidat release.
Browser memakai fixture terisolasi dari `tests/rendered-html.test.mjs`, tidak
terhubung ke database operasional. URL fixture berbeda setiap kali dijalankan;
gunakan URL yang dicetak harness, jangan menganggap port lama masih hidup.

## Batas bukti dan dependensi

Pembaruan prasyarat lokal2026-09-16: lihat OPS_LOCAL_READINESS.md. Redis/ClamAV nyata,
ops config, storage eksternal dan audit repository sudah ditangani pada follow-up.
Hitungan direktori kini satu batch hanya untuk ID pada halaman terpilih, bukan
agregat berulang sebelum pagination. Eligibility, DTO, filter dan cursor tidak
berubah; empat kelompok uji DB public diulang dan lolos. Pipeline upload/media
juga diuji terpisah memakai database baru dan layanan nyata, bukan dataset benchmark.
Batas historis pengujian OPS-03 sebelum follow-up tercatat berikut ini:

- Pagination deterministik pada dataset stabil, bukan snapshot lintas permintaan.
  Publikasi berubah/kedaluwarsa di tengah penelusuran dapat mengubah halaman.
- DB tes menguji volume dan eligibility dengan data tanah; atribut kategori lain
  diuji unit/kontrak. Tidak ada file foto fisik pada dataset DB tersebut; media HTTP
  dan galeri diperiksa dengan fixture terpisah. Bukan uji beban/performa produksi.
- Tidak mengulang matriks visual semua browser/semua lebar dari tahap redesign.
  Tidak menyalakan API/ingest/worker operasional atau menguji pipeline upload/scanner.
- Redis/ClamAV, private ops credentials, konfigurasi storage, serta migration OPS-02
  yang belum diterapkan ke DB workflow tetap dependensi operasional tahap berikutnya.
- Pemeriksaan repository-wide audit lama memiliki referensi PageIntro yang dihapus
  pada pekerjaan sebelumnya; tidak diubah atau diklaim lolos oleh OPS-03.
- Tidak ada perubahan repository BE/FE Ruwang/Control, migration historis, status SQL,
  database operational, commit, push, deployment, atau VPS.
