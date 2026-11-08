# Tahap 10 — verifikasi redesign

Tanggal: 14 September 2026. Repository terkonfirmasi: `D:\seputarjaminan-production`.

## Status kerja

Selesai untuk verifikasi dan perbaikan lokal tahap 10. Build final lokal: `SXZbirmKM3HBRpfyNre4n`. Bukan deployment atau klaim siap produksi. Ringkasan mesin: `output/playwright/stage10-results.json`; indeks bukti: `output/playwright/STAGE10_EVIDENCE.md`.

Pemulihan setelah jaringan terputus: log proses diperiksa, exit proses lama diambil kembali, dan 17 hash sumber handoff tahap 9 cocok sebelum perubahan tahap 10. Seluruh perubahan pengguna sebelumnya tetap dipertahankan. API/preview 4410/4411 tidak aktif; pengujian memakai server Next production dengan upstream fixture loopback terisolasi. Tidak ada DB/produksi atau WhatsApp yang dimutasi.

## Perubahan tahap ini

- `eslint.config.mjs`: abaikan `work/**`, folder scratch lokal yang sudah diabaikan Git. Sebelumnya lint penuh menghitung 32 error dari expression Playwright CLI dan skrip migrasi sementara tahap lama. Kode aplikasi, workspace backend, dan tes resmi tetap dilint; tidak ada rule aplikasi yang dimatikan.
- `app/favicon.ico/route.ts`: redirect same-origin ke ikon `app/icon.svg` yang sudah ada. Memperbaiki request legacy `/favicon.ico` 404 sebelum metadata icon tersedia. Bentuk/logo asli dipertahankan: percobaan ikon baru sempat dibuat lalu dibatalkan saat pemeriksaan diff menunjukkan aset branding existing sudah tersedia. Tidak mengganti logo BPRS atau komposisi halaman.
- `app/layout.tsx`: opt-in `data-scroll-behavior="smooth"` untuk Next 16 agar route transition menangguhkan CSS smooth-scroll global. Regresi ditemukan pada mode normal: detail kadang masuk di scroll 305 px dan h1 y−100,4 px. Kasus reduced motion dan beberapa entry terpisah tidak memunculkannya; hasil itulah alasan pemeriksaan awal belum cukup. Perbaikan mengikuti guide lokal Next 16 bagian Scroll Behavior Override.
- Harness perilaku lokal di `work/stage10-*.js`, bukti di `output/playwright/`, dan dokumen ini. Tidak ada perubahan kontrak/API/backend/dependency.
- Tes browser resmi katalog → detail diperkuat dengan assertion seluruh heading masuk viewport, bukan sekadar `isVisible`. Harness CLI tambahan memeriksa posisi terhadap header dan restorasi scroll, bukan menyalin fungsi implementasi.

## Pemeriksaan repository (build final)

| Pemeriksaan | Hasil aktual |
| --- | --- |
| `npm test` | PASS: 8 contract + 7 foundation + build production/TypeScript + 38 rendered |
| `npm run lint` | PASS, seluruh repository selain output/generated/scratch sesuai config |
| `npm run typecheck` | PASS standalone |
| Existing Playwright suite | PASS 5/5, Chromium, final fixture production |
| `git -c core.safecrlf=false diff --check` | PASS pada handoff |

### Browser final: 224 pemeriksaan lokal PASS

- 34 cek perjalanan utama: light 1440 dan dark 390, animasi normal lalu pergantian reduced motion.
- 30 regresi entry: foto/judul/CTA × 360/390/768/1024/1440 × normal/reduced; identitas detail masuk viewport, lalu kembali ke scroll katalog yang tersimpan.
- 18 cek query/sort, Back/Forward, pagination, reset, retry, BPRS → profil → detail.
- 122 cek interaksi light/dark pada kelima lebar, termasuk menu/filter, galeri, keyboard, focus restore, offline/sticky CTA.
- 14 cek empty/no-match/error/timeout/foto gagal/data parsial.
- 6 kombinasi preferensi tema × tema OS: tema pada RAF pertama yang diamati dan sesudah reload benar, tanpa pageerror; resource ikon HTTP 200. Bukan rekaman video setiap frame pada seluruh jenis perangkat.

Seluruh suite di atas dijalankan ulang pada build final setelah koreksi scroll, bukan menggunakan hasil build sebelum perbaikan. Existing suite 5/5 juga dijalankan ulang dengan assertion regresi baru.

`npm test:unit` lintas backend serta DB/Redis integration tidak dijalankan: bukan perubahan UI ini dan membutuhkan prasyarat lain. Build compile 9,2 detik bukan metrik performa pengunjung.

## Matriks perjalanan

| Permintaan | Pemeriksaan perilaku |
| --- | --- |
| Beranda → pencarian → detail → WhatsApp | Cari Rumah, klik kartu, parse href (bukan kirim), cocokkan nomor konfigurasi fixture, nama, kode, origin publik, encoding dan target aman |
| Beranda → kategori → detail | Bangunan menghasilkan 2 kartu fixture, membuka detail aset yang sama |
| Direktori → profil → aset | Profil Amanah → SJ-TEST0001 → href kontak publikasi |
| Kombinasi filter → chip → reset | Jenis + provinsi + BPRS; draft tidak langsung mengubah URL; hapus satu dimensi menjaga yang lain; reset kembali 5 aset |
| Detail → hasil tersimpan | Query + sort + posisi scroll tersimpan; Back/Forward dan pagination manual diuji |
| Tema → navigasi → reload | Pilihan manual persist; Ikuti perangkat merespons perubahan OS |
| Galeri/menu keyboard | Arrow, Enter, Tab/Shift+Tab trap, Escape/fokus kembali, posisi scroll menu, zoom galeri |
| Reduced motion | Logo menjadi statis; tidak ada animasi infinite yang berjalan; interaksi tetap dapat dipakai |
| Kosong/error/kontak hilang | Dataset 0 berbeda dari no-match; API 503/timeout tidak menjadi daftar kosong palsu; retry/reset; foto gagal; WA invalid disabled |

Nomor hilang tidak boleh diasumsikan sebagai DTO valid: kontrak saat ini menolak field WhatsApp kosong sehingga detail masuk error. URL invalid pada DTO yang lolos struktur menampilkan tombol disabled. Status nonpublik diuji rendered sebagai 404, bukan badge publik yang dibuat sendiri.

## Gambar, font, dan performa

Metode: Next production, Chromium, konteks baru per halaman, 1440×900 light dan 390×900 dark; PerformanceObserver dipasang sebelum navigasi untuk LCP/CLS, observasi sampai 1,8 detik setelah load/font ready. CLS memakai jendela sesi (gap 1 detik/maksimum 5 detik). Ini sampel lab singkat, bukan Lighthouse/CrUX/p75 atau klaim INP.

- Dua WOFF2 self-hosted: Manrope 24.836 byte + Source Sans 3 28.740 byte = 53.576 byte. Tidak ada request Google Fonts.
- Hero dan foto pertama detail dipreload. Foto kartu/logo/thumbnail lainnya menggunakan native lazy loading. Browser boleh memuat item dekat viewport; fixture berbagi URL sehingga cache membuat gambar berulang tampak sudah loaded. Ini tidak membuktikan penghematan bandwidth katalog nyata.
- Worker yang sudah ada melakukan auto-orient, resize maksimal 2560×2560 tanpa memperbesar, WebP quality 85. Tidak diubah tahap ini. `PublicMedia` tetap unoptimized karena validasi dimensi asli dan proxy media existing; tidak menyalakan resize kedua yang akan merusak kontrak validasi/cache. Responsive thumbnail renditions masih kandidat optimasi setelah ada bukti ukuran foto asli.
- Baseline lokal 12 sampel: LCP teks 116–240 ms; build final 12 sampel: LCP teks 136–384 ms. CLS keduanya 0–0,0002264. Semua sampel final tanpa console error, pageerror, atau fallback media tak terduga; dua font loaded. Fixture WebP bidang warna sangat kecil; LCP teks ini bukan waktu tampil foto produksi. Tambahan respons katalog sengaja lambat 4,2 detik pada baseline menghasilkan LCP mobile sekitar 4,324 detik—menunjukkan ketergantungan pada API, bukan compile development.
- Beberapa prefetch `_rsc` dibatalkan saat konteks browser ditutup; dicatat sebagai `net::ERR_ABORTED`, bukan error foto/font/runtime pengguna. Error jaringan fixture yang sengaja dipicu dilaporkan terpisah.

## Koreksi alat uji, bukan perubahan aplikasi

Percobaan awal: nama tombol skrip `Terapkan filter` keliru (UI konsisten `Tampilkan hasil`); link mobile memiliki prefiks nomor sehingga selector exact keliru; pengecekan heading terlalu cepat sebelum streaming selesai. Selector/wait tersebut dikoreksi. Screenshot awal juga mengarahkan audit pada regresi scroll normal yang benar-benar ada (lihat perbaikan layout di atas), bukan seluruhnya kesalahan harness. Bukti final menunggu identitas aset benar-benar berada di viewport sebelum capture. Percobaan gagal tidak dihitung PASS.

## Batas yang tetap terbuka

## Integritas dan cleanup handoff

46 PNG tahap 10 diperiksa signature/chunk CRC/IEND; hasil tersimpan di `stage10-integrity.json` bersama hash sumber dan harness. Empat PNG diagnostik sebelum perbaikan diberi label terpisah di indeks. File branding `app/icon.svg` kembali identik dengan kondisi awal. Semua server fixture serta sesi browser milik audit ditutup setelah bukti disimpan; tidak menghapus bukti, menjalankan migrasi, atau menghentikan proses pengguna lainnya.

Sampel tambahan slow API pada build final: desktop LCP 108 ms (heading loading), mobile LCP 4.332 ms (hasil), CLS 0 pada jendela observasi. Perbedaan kandidat LCP menjelaskan mengapa angka desktop tidak boleh ditafsirkan sebagai katalog selesai dalam 108 ms.

### Dependensi yang belum diverifikasi

- API/data/foto/logo/konfigurasi BPRS asli belum aktif untuk diuji. Fixture 5 aset/9 BPRS bukan representasi seluruh Indonesia, akurasi pencarian/sort/count DB, atau seluruh variasi foto nyata.
- Firefox, WebKit, perangkat fisik, screen reader, keyboard virtual, jaringan mobile nyata dan uji pengguna awam belum dijalankan.
- Tidak mengirim WhatsApp, sehingga pembukaan aplikasi eksternal/delivery pesan tidak diverifikasi; hanya tujuan dan isi URL.
- Tidak mengubah produksi, melakukan commit/push/deploy, atau menyatakan seluruh website bebas bug.
