# Build kandidat rilis SJ

Panduan ini menjelaskan entrypoint build yang berlaku pada source saat ini.
Keberhasilan build tidak menyatakan VPS, backup/restore atau layanan produksi
sudah diverifikasi. Catatan hasil OPS-01/OPS-09 dan OPS_LOCAL_READINESS bertanggal
lama tetap bukti historis, bukan target versi dependency atau jumlah migration.

## Checkout dan dependency

Gunakan checkout rilis baru pada commit SHA yang sudah diuji. Pertahankan build
dan dependency lama sebagai bukti terpisah; jangan membangun pada output milik
preview atau proses yang masih berjalan. Versi dependency ditentukan
`package.json` dan `package-lock.json` pada commit itu.

```sh
npm ci
npm run build:release
```

`npm ci` memasang dependency locked dan menjalankan postinstall pembuat client
Prisma; ia tidak menerapkan migration. Berikan hanya environment yang sesuai
untuk tahap install/build. Konfigurasi website tetap mengikuti aturan Next.js
untuk `.env*`; jangan meletakkan credential API, worker atau migrator pada file
environment website. Panduan batas proses ada di [LOCAL_OPERATIONS.md](LOCAL_OPERATIONS.md).

## Tiga output yang wajib

`npm run build` tetap membangun website saja. `npm run build:release` memeriksa
versi Next dan esbuild yang terpasang terhadap lockfile sebelum builder mengubah
output, lalu menjalankan secara berurutan:

1. Website: `npm run build` menghasilkan `.next`.
2. API: `npm run build --workspace @seputarjaminan/api` menghasilkan `apps/api/dist/server.mjs`.
3. Worker: `npm run build --workspace @seputarjaminan/worker` menghasilkan `apps/worker/dist/server.mjs`.

Jika tool belum cocok, spawn gagal, proses terputus, atau salah satu builder
gagal, command rilis berakhir gagal dan builder berikutnya tidak dijalankan.
Output parsial dari run gagal tidak boleh dipromosikan menjadi rilis berhasil.
Pemeriksaan dua build tool ini bukan pengganti `npm ci` untuk seluruh dependency
graph. CI Quality memanggil entrypoint yang sama setelah install locked.

## Pemeriksaan target sebelum aktivasi

Website, API dan worker tetap proses berbeda dengan environment masing-masing.
Root `npm start` hanya website. API dan worker memakai perintah `start` workspace
dan bundle `dist/server.mjs` masing-masing. `build:release` tidak menjalankan
service, migration, reset/seed, Docker, backup atau deployment.

Sebelum update target, verifikasi identitas VPS/instance dan SHA, environment
production, empat role DB API yang terpisah serta role worker/migrator, status
migration dari source saat ini, Redis, storage persisten beserta threshold, dan
scanner ClamAV native milik worker. Default lokal, Docker scanner dan TEST_SAFE
bukan konfigurasi scanner produksi. Worker harus diaktifkan secara eksplisit
sesuai rencana operasi, bukan oleh script build.

Backup database dan file yang konsisten, salinan di luar VPS, checksum serta
uji restore pada lingkungan terpisah harus mempunyai bukti sebelum aktivasi
atau migration. Domain/origin HTTPS, reverse proxy, health/readiness, proses dan
rollback aplikasi juga diperiksa pada target. Dokumen ini tidak memberi status
PASS untuk prasyarat yang belum dijalankan tersebut.
