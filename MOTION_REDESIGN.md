# Tahap 8 — motion pendukung

Tanggal: 14 September 2026. Scope frontend publik; bukan deployment atau perubahan data.

## Keputusan implementasi

| Area | Perilaku |
| --- | --- |
| Marquee BPRS | CSS translateX(-50%) → 0, linear 24 px/detik. Dua kelompok identik, tanpa penggandaan untuk memaksakan sedikit penerbit memenuhi baris. ResizeObserver mengukur jumlah × lebar item terhadap viewport. |
| Jumlah sedikit | Nol memakai state beranda; satu tetap komposisi identitas; dua atau lebih statis selama total lebar item belum memenuhi viewport. SSR selalu statis sampai kapasitas layar diketahui. |
| Logo | Container seragam, object-fit contain, permukaan putih dari token logo, tanpa filter/inversi. Kualitas/ukuran optis logo nyata tetap perlu pemeriksaan dataset sebenarnya. |
| Jeda | Hover/fokus pada section dan tombol jeda menghentikan clock CSS, bukan menghapus animasi. Pilihan jeda bertahan setelah pointer/fokus keluar. Resume manual tetap menunggu hover/fokus keluar. |
| Keyboard | Hanya kelompok asli masuk Tab. Fokus logo di luar viewport diberi offset pada pembungkus terpisah agar seluruh target terlihat; clock loop tetap dijeda. Offset dikembalikan setelah fokus keluar. |
| Salinan loop | Kelompok aria-hidden dan semua tautannya tabindex=-1. Pointer tetap dapat membuka profil yang sama pada salinan visual; tidak ada CTA atau urutan keyboard tambahan. |
| Reduced motion | CSS dan matchMedia mengubah rel menjadi grid statis, menyembunyikan salinan/tombol jeda; perubahan preferensi didengarkan langsung. |
| Hero | Hanya visual masuk 280 ms, y=8 px dan opacity .88→1, sekali per pemasangan halaman. Teks, pencarian, kategori tidak dianimasikan masuk. Caption langsung berganti tanpa menunggu exit. Embla tetap manual; reduced motion memakai jump/duration=0. |
| Kartu | Foto zoom 1.025 pada perangkat hover/fokus, tanpa filter; border 180 ms dan panah 2 px saat interaksi. Tidak ada cascade/stagger seluruh kartu. |
| Tombol | Tekan scale .985 / 180 ms untuk kontrol bersama yang aktif. Disabled tidak mendapat efek; reduced motion hanya memakai perubahan warna. |
| Panel | Filter masuk 280 ms / 18 px; menu masuk 280 ms / -8 px, tanpa urutan reveal tautan. Fokus, Escape, pengembalian fokus dan scroll tetap dari implementasi sebelumnya. |
| Galeri | Frame foto fade ringan .82→1 selama 180 ms; PhotoSwipe tetap memakai durasi 280/220 ms yang sudah ada, nol pada reduced motion. Tidak autoplay. |
| Skeleton | Mempertahankan sweep lembut existing 1.45 detik; reduced motion statis. Loading tidak menambah delay buatan ke permintaan data. |
| WhatsApp/status | Tidak ada animasi berulang, pulse, bounce, atau nomor baru. URL kontak tidak diubah tahap ini. |

Tidak menambah dependency animasi. CSS dipakai untuk interaksi sederhana; Embla, PhotoSwipe dan motion yang sudah ada tetap dipakai sesuai kebutuhan.

## Peta file

- `app/components/BprsMarquee.tsx` dan CSS module: kapasitas, loop, pause, keyboard, reduced motion.
- `app/components/HeroAssetCarousel.tsx`, `app/home.module.css`: hero visual dan caption langsung.
- `app/components/AssetCard.module.css`, `app/shared-components.css`: kartu dan feedback tekan.
- `app/katalog/catalog.module.css`, `app/globals.css`: filter dan menu.
- `app/components/AssetDetailGallery.tsx`, `app/design-system.css`: frame galeri dan penghapusan reveal global pada konten publik.
- `tests/rendered-html.test.mjs`: kontrak markup statis sebelum pengukuran, clone a11y, caption dan motion baru.

## Verifikasi / checkpoint

- Build final setelah penyederhanaan menu: `npm test` exit 0 — kontrak 8/8, foundation 6/6, Next production build + TypeScript, rendered 38/38. Existing Chromium diulang terhadap build final: 5/5. Lint terarah dan TypeScript standalone exit 0; `git diff --check` exit 0.
- Playwright CLI final: **285 pemeriksaan lulus** (185 marquee pada 16 kombinasi viewport/theme/motion; 86 kapasitas dua logo/kontrol/panel/galeri/navigasi; 14 logo hilang/skeleton/live theme/live reduced/touch). Viewport 1440/1024/480/390/320 sesuai skenario; dua tema dan dua preferensi motion. Tidak ada page/hydration error pada skenario normal; HTTP 404 media disengaja pada fixture broken, bukan kegagalan aplikasi normal.
- Clock loop diuji sebelum/sesudah perubahan light→dark, tidak reset dan tetap paused. Tes secara eksplisit memilih CSSAnimation drift, bukan CSSTransition warna yang juga dikembalikan getAnimations(); pengukuran awal generik menimbulkan false failure dan telah diulang.
- 26 screenshot final tersimpan; komposisi marquee desktop dark/mobile reduced, menu final, filter dan placeholder satu logo ditinjau secara visual. Arah dan sambungan loop dibuktikan juga melalui transform/clock, bukan screenshot diam saja.
- Screenshot dan skrip reproduksi: `output/playwright/stage8-*.png`, `work/stage8-*-qa.js` (harness lokal, tidak dimuat aplikasi).
- Tes lama awalnya gagal karena mengunci rail SSR/opsi Embla sebelumnya. Assertion diperbarui untuk perilaku kapasitas nyata, lalu 38/38 lulus. Satu skrip QA menemui dua node sementara dalam streaming Next; selector visible dipakai dan seluruh skrip diulang hingga lulus.
- Inspeksi fixture lama sempat beririsan dengan rebuild `.next`, menghasilkan resource 500. Bukan hasil PASS: semua fixture lama dihentikan, lalu QA 285 cek dan existing 5 tes diulang pada server baru setelah build final selesai.
- Cleanup terverifikasi: browser `sj-stage8` ditutup, seluruh listener fixture 55522/53895/55186/61749/61750/61752 berhenti. Port API/preview yang sejak awal tidak aktif tidak diganti dengan server demo. Tidak menghentikan proses Node aplikasi lain.

## Batas bukti

API upstream 4410 dan preview 4411 tidak aktif pada awal tahap. QA menggunakan fixture lokal terisolasi (media bidang warna, bukan foto/logo produksi). Tidak mengubah env, backend, kontrak, data publik, dependency atau melakukan commit/push/deploy. Browser/perangkat fisik lain, screen reader nyata, ketepatan optis logo produksi, integrasi API sebenarnya, dan uji pengguna awam tetap merupakan QA lanjutan; ini bukan klaim seluruh website bebas bug atau siap produksi.
