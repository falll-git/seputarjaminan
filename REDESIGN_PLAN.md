# Seputarjaminan — audit tahap 1 dan rencana redesign

Tanggal audit: 13 September 2026. Sasaran: frontend publik, bukan aplikasi internal BPRS.

Status terbaru (14 September 2026): tahap 10 verifikasi lokal selesai, termasuk koreksi scroll Next 16. Lihat `REDESIGN_VERIFICATION.md` dan handoff paling atas `REDESIGN_PROGRESS.md`. Isi audit tahap 1 di bawah merupakan baseline historis; batas integrasi data asli tetap terbuka.

## 1. Kesimpulan dan batas bukti

Fondasi fungsional sudah cukup lengkap; tidak perlu mengganti stack atau membangun seluruh fitur dari nol. Hambatan utama adalah hierarki informasi, kepadatan tampilan yang tidak seimbang, pengulangan konten, beberapa detail navigasi, serta belum adanya palet/tema yang disepakati. Kartu sudah merupakan komponen buatan proyek, tetapi bentuk dan hierarkinya perlu didesain ulang secara nyata, bukan sekadar mengganti warna.

**Tahap 1 menghasilkan audit kode, audit browser fixture, dan rencana. Pemeriksaan runtime/data asli belum tuntas. Tidak ada implementasi UI pada tahap ini.**

| Tingkat bukti | Hasil |
| --- | --- |
| Repository | `D:\seputarjaminan-production`, sesuai lokasi yang dikonfirmasi pengguna dan struktur aplikasi. Git root terkonfirmasi; branch `main`, HEAD `32fc315`, dengan perubahan lokal yang belum di-commit. |
| URL yang diminta | `http://127.0.0.1:4411/` kembali menghasilkan `ERR_CONNECTION_REFUSED`. Tidak ditemukan listener 4411 maupun API lokal 4410 saat audit. Tidak ada proses aktif yang dapat dipastikan melayani URL tersebut. |
| Konfigurasi lokal | Origin API website mengarah ke `http://127.0.0.1:4410`. Nilai rahasia tidak disalin. `packages/config/src/public.mjs` mensyaratkan HTTPS pada mode production, kecuali izin loopback eksplisit. Flag loopback tidak aktif pada konfigurasi lokal yang diperiksa; ini bukan masalah pada mode development. Jangan mengubah environment otomatis. |
| Runtime audit alternatif | Build dari repo ini dijalankan oleh harness milik repo, `tests/rendered-html.test.mjs`, melalui child process `next start --hostname 127.0.0.1` pada port sementara 65518. Harness memberikan API fixture loopback terisolasi dan izin loopback hanya kepada child tersebut. Tidak menjalankan API/worker/database produksi. |
| Bukti visual | 18 kombinasi halaman/viewport pada Chromium: enam halaman pada desktop 1440 dan mobile 390; beranda/katalog/detail juga pada 320 dan 430. Screenshot dan metrik berlabel fixture, bukan tampilan data BPRS nyata. |
| Batas kesimpulan | Tidak mengaudit deployment publik, tidak menguji pengiriman WhatsApp, tidak membuktikan data/nomor BPRS asli, pagination nyata, maupun performa produksi. Website belum dinyatakan selesai. |

### Kondisi worktree dan instruksi

- `AGENTS.md` dibaca. Proyek memakai Next versi yang mengharuskan referensi dokumentasi lokal di `node_modules/next/dist/docs/` sebelum perubahan kode; jangan mengandalkan asumsi API versi lama.
- Baseline awal: 24 file tracked berubah, 332 penambahan/96 penghapusan, serta 12 entri untracked termasuk `REDESIGN_PROGRESS.md`. Pekerjaan ini mencakup frontend, API, worker, konfigurasi, kontrak, dan tes milik pengguna. Semuanya dipertahankan.
- Tahap ini hanya menambah rencana dan memperbarui dokumen progres. Build dan tes menghasilkan artefak diagnostik, tidak mengubah source aplikasi atau kontrak.
- Tidak ada commit, push, instalasi dependency, deployment, migrasi, perubahan data, atau perubahan aplikasi internal lain.

## 2. Baseline teknologi dan arsitektur

| Bagian | Kondisi aktual | Implikasi redesign |
| --- | --- | --- |
| Framework | Next.js 16.3.4 App Router, React 19.2.8, TypeScript 5.9.3; Node audit 24.13.0, engine proyek >=22.13.0 | Tetap gunakan arsitektur ini. |
| Struktur | Website pada `app/`; `apps/api`, `apps/worker`, `packages/config`, `packages/contracts`, dan storage adalah bagian monorepo | Membaca asal data boleh; redesign bukan izin mengubah bagian internal. |
| Data | Server components memanggil `app/lib/public-api.ts`; fetch `no-store`, timeout 5 detik, validasi payload; adapter presentasi `app/data/catalog.ts` | Bedakan fetching, mapping, dan presentasi. Jangan mengisi kegagalan API dengan data contoh. |
| Styling | CSS global berurutan: `globals`, `editorial`, `routes`, `design-system`, `system-states`, `marketplace`; marquee memiliki CSS module | Banyak selector bertumpuk. Migrasi token dan ownership style bertahap; jangan menambah satu lapisan override besar lagi. |
| Font aktual | Schibsted Grotesk Variable, IBM Plex Sans Variable, IBM Plex Mono dari paket lokal | Target Manrope + Source Sans 3 belum tersedia di dependency. Siapkan font self-hosted/fallback pada tahap 2, bukan memaksakan CDN. |
| Tema | Belum ada pilihan Terang/Gelap/Ikuti perangkat | Membutuhkan token semantik, preference persistence, deteksi perangkat, dan sinkronisasi first paint. |
| Library interaksi | Radix Dialog 1.1.23, React Aria Components 1.20.0, Motion 13.1.1, Embla 8.6.0, PhotoSwipe 5.4.4, Phosphor 2.1.10 | Cukup untuk komponen custom dengan aksesibilitas; tidak perlu UI kit baru. |
| Gambar | `PublicMedia` + Next Image unoptimized, URL browser `/media/<id>`; proxy menerima WebP dan membatasi ukuran 10 MiB | Jangan mengganti foto dengan ilustrasi stok/AI. Pertahankan proxy, alt, rasio, loading, dan fallback. |
| Pengujian | Node rendered tests, Playwright 1.61.1, TypeScript, ESLint; backend/unit/integration terpisah | Tes render banyak mencakup pola source/SSR, bukan semuanya interaksi browser. Jangan menyebutnya cakupan E2E penuh. |

`global-error.tsx` memuat ulang font dan CSS sendiri, tetapi belum memuat `marketplace.css`. Perubahan fondasi wajib memperhitungkan halaman error global, portal dialog, dan PhotoSwipe di luar container halaman.

## 3. Peta halaman dan perilaku

| Halaman/alur | Source dan komponen | Perilaku saat ini | Arah perubahan |
| --- | --- | --- | --- |
| Beranda `/` | `app/page.tsx`; `HeroAssetCarousel`, `BprsMarquee`, `AssetCard`, `EditorialRevealSection` | Server mengambil aset terbaru limit 7, taxonomy, BPRS limit 16. Search GET ke katalog, shortcut kategori, hero manual, logo rail, indeks kategori kedua, 3 kartu terbaru, penjelasan proses | Satukan pembuka/pencarian, tampilkan aset lebih cepat, hilangkan pengulangan kategori; proses ditulis dari sudut pengunjung. |
| Katalog `/katalog` | `app/katalog/page.tsx`; `CatalogClient`, `CatalogCombobox`, `AssetCard`, `AssetDossier` | URL `q/category/bprs/province/sort/cursor`; limit 24; urutan terbaru/terlama. Desktop filter langsung diterapkan; mobile draft lalu Terapkan. Mengganti filter menghapus cursor. Next cursor menuju halaman berikut, bukan menambah kartu ke halaman yang sama | Header ringkas, grid konsisten, filter aktif terbaca dan dapat dihapus satu per satu, kontrol tetap dapat ditemukan saat gagal/kosong. |
| Detail `/aset/[slug]` | `app/aset/[slug]/page.tsx`; `AssetDetailGallery` | Slug dipetakan ke kode SJ, detail + BPRS + aset terkait. Galeri berada sebelum judul pada mobile; spesifikasi hanya dari detail. Back link selalu `/katalog`. CTA desktop dan sticky mobile memakai URL WA API | Pertahankan konteks pencarian ketika kembali, judul/lokasi mudah dikenali sebelum eksplorasi foto; galeri dan kontak dominan tanpa menambah transaksi. |
| Quick view | `AssetDossier`, `MediaLightbox`, `/api/public/assets/[referenceCode]` | Dibuka oleh tombol terpisah; detail diambil saat membuka, abort ketika perlu, retry tersedia. Menampilkan hingga 5 spesifikasi; foto bisa dibuka lebih besar; sharing/clipboard tersedia | Tetap opsional, tidak menjadi langkah wajib menuju detail atau WA. Satukan bahasa dan identitas visual dengan detail. |
| Direktori `/bprs` | `app/bprs/page.tsx`; `BprsDirectory` | Limit 24; q, provinsi kantor, cursor. Search muncul jika >=8 entri, ada filter, atau next cursor. Satu BPRS mendapat layout feature; daftar kecil berbeda dari daftar besar | Identitas BPRS mudah dipindai; search konsisten dan ringkas, tanpa intro/angka dekoratif besar. |
| Profil `/bprs/[slug]` | `app/bprs/[slug]/page.tsx`; `BprsMark`, `AssetCard` | Identitas publik, deskripsi, lokasi kantor, jumlah publikasi, hingga 24 aset. Link “Buka di katalog” scoped BPRS. Profil tidak menampilkan pagination aset sendiri | Pertahankan scoped catalog sebagai jalur semua aset; jangan menyamakan jumlah kartu pada halaman dengan jumlah total BPRS. |
| Panduan `/cara-minat` | `InterestJourney`, `PageIntro` | Tiga langkah, preview pesan, pertanyaan, konfirmasi, batas peran situs, CTA penutup | Ringkas menjadi cari → baca → WhatsApp. Pertanyaan lanjutan boleh menyebut harga/jadwal sebagai topik WA, bukan field situs. |
| Header/footer | `SiteHeader`, `SiteFooter`, `BrandLockup` | Header compact saat scroll; menu mobile Radix dengan focus restoration; footer besar mengulang navigasi dan disclaimer | Navigasi lebih ringkas, label awam, theme switch, skip link; footer secukupnya. |
| Loading | `app/loading.tsx` dan loading route katalog/BPRS/profil/detail; `PublicLoadingState` | Placeholder/skeleton mengikuti jenis halaman | Geometri mendekati konten final, tidak menggeser CTA/hasil secara besar. |
| Empty/no-results | `PublicDataState`; empty spesifik di client katalog/direktori | Memisahkan belum ada publikasi vs pencarian tidak cocok; ada reset pencarian | Konten singkat dan aksi pemulihan sesuai penyebab. Jangan membuat publikasi palsu. |
| Error/timeout | `PublicDataState`, `UnexpectedErrorPage`, route `error.tsx`, `global-error.tsx` | Pesan Indonesia, retry reload/reset; katalog gagal menyembunyikan seluruh filter | Pulihkan tanpa menghapus konteks pengguna; perbaiki copy internal yang tidak membantu pengunjung. |
| Offline | `ConnectivityNotice` | Memantau status browser online/offline | Tetap berupa informasi koneksi, bukan janji akses offline penuh/cached catalog. |
| Not-found | `PublicNotFoundState`, not-found umum/aset/BPRS | Alamat/kode tidak valid atau data tidak tersedia memberikan jalur kembali | Jangan menyimpulkan aset terjual/ditarik dari respons 404. |

## 4. Asal data publik dan batas internal

Aliran yang diverifikasi dari kode: publikasi/profil/media/kontak internal → seleksi visibilitas di API SJ → DTO publik → validasi `public-api.ts` → adapter `catalog.ts` → komponen website. Penelusuran ini membaca kode; bukan pembuktian isi database terkini.

| Informasi | Sumber yang benar | Batas penggunaan |
| --- | --- | --- |
| Status aset | `apps/api/src/public-service.ts:131` menyaring PUBLISHED + AVAILABLE, reconfirmation belum jatuh tempo, institusi/profil aktif, kontak VERIFIED, cover READY. `app/lib/public-api.ts:102` menerima availability AVAILABLE; `app/data/catalog.ts:159` memetakannya ke **Tersedia** | Status internal PUBLISHED/ACTIVE/VERIFIED/READY tidak dijadikan badge aset. Tidak ada status publik “Siap dipasarkan”, “Siap dilelang”, “Terverifikasi”, “Terjual” yang boleh ditambahkan sekarang. |
| Foto kartu | DTO card `cover` berisi URL media publik, dimensi, alt; `photo_count` dari media READY publikasi | Foto asli melalui proxy; bukan foto acak atau logo BPRS sebagai pengganti foto aset. Jika media buruk, tampilkan fallback jujur. |
| Galeri | DTO detail `media`, urutan dari `sortOrder` media publikasi | Jangan memunculkan berkas privat atau storage path. Uji satu foto, banyak foto, orientasi berbeda, gagal muat. |
| Spesifikasi | `attributesFor` di API memilih atribut kategori; adapter detail memformat label dan satuan seperti m²/km/lantai | **Card API tidak memuat spesifikasi.** Jangan menambahkan luas/tahun/km pada katalog dengan mengarang atau fetching detail per kartu. Tampilkan di detail/quick view; kebutuhan card enrichment harus dibuktikan dan dimintakan persetujuan terpisah. |
| Identitas BPRS | public slug/name/mark dari profile publik; lokasi kantor, short description, published_asset_count pada DTO institution | Kota kantor bukan kota aset. Jumlah BPRS/asal geografis tidak membuktikan seluruh BPRS se-Indonesia telah terhubung. |
| WhatsApp | `public-service.ts:262` mengambil kontak yang dikaitkan ke publikasi, membentuk `wa.me` dari phoneE164 dan template kode/judul; `catalog.ts:192` meneruskan `detail.whatsapp_url` | Gunakan URL ini pada detail dan dossier. Jangan mengganti dengan nomor global/perkiraan; jangan membuat form lead. Pesan dipersiapkan, bukan otomatis terkirim. Nomor tujuan dapat dibaca dari href: bukan rahasia setelah menjadi URL kontak publik. |
| Referensi/tanggal | `reference_code`, `public_updated_at` | Tanggal pembaruan bukan jadwal lelang. Referensi berguna untuk percakapan WA, bukan nomor lot bidding. |

Data internal yang tidak menjadi materi publik: state review/sinkronisasi, event/ingest, konfigurasi layanan/credential, status rekonsiliasi/reconfirmation internal, berkas privat, serta relasi database yang tidak masuk DTO. DTO publik tidak menyediakan harga, jadwal lelang, pembayaran, atau kewajiban autentikasi. Tidak ada alasan UI untuk mengubah kontrak tersebut.

Media proxy memvalidasi ID, MIME dan ukuran, lalu mengirim media publik. `PublicMedia` menolak sumber/alt/dimensi yang tidak cocok; fallback ini harus dipertahankan. Kerusakan foto demo tidak boleh disamarkan oleh gambar stok.

## 5. Temuan prioritas

Prioritas di bawah adalah urutan dampak UX, bukan severity keamanan. “Terbukti” berarti source + browser fixture bila disebut; “risiko” belum dibuktikan pada data asli.

| ID | Prioritas / bukti | Temuan dan dampak | Tindakan yang direncanakan |
| --- | --- | --- | --- |
| UX-01 | Tinggi, visual + metrik | Katalog desktop h1 83,52 px; pada mobile 390 h1 50,7 px dan kartu pertama mulai sekitar y=882 pada tinggi viewport 844. Hasil terdorong ke bawah oleh intro dan toolbar | H1 katalog 28–36 px mobile, intro satu kalimat; pada 390×844 target awal gambar kartu pertama <=520 px di kondisi normal. |
| UX-02 | Tinggi, source + browser | Isi pencarian yang belum dikirim tidak kosong saat tombol Hapus ditekan. Repro: buka katalog tanpa q → ketik Rumah → klik Hapus; input masih Rumah. `CatalogSearch` menyimpan value sendiri sementara clear hanya push URL yang sama (`CatalogClient.tsx:172`) | Reset input lokal dan URL secara konsisten. Tambahkan tes untuk draft belum dikirim dan query yang sudah dikirim. |
| UX-03 | Tinggi, source + href browser | Back link detail selalu `/katalog`, sehingga kategori/query/BPRS hilang pada jalur kembali eksplisit (`app/aset/[slug]/page.tsx:95`) | Simpan asal katalog yang valid/same-origin beserta query; direct landing fallback katalog. Jangan menerima return URL eksternal. |
| UX-04 | Tinggi, source + visual | Beranda memiliki panel search dan hero terpisah, kategori diulang. Kartu bagian terbaru sekitar y=2398 pada 390; hero sudah memiliki link aset lebih awal, jadi bukan berarti aset sama sekali tidak dapat dibuka sebelum itu | Satu pembuka dengan pencarian, kategori satu kali, showcase singkat, aset terbaru sebelum blok edukasi panjang. |
| UX-05 | Sedang, visual + source | Katalog memakai kartu wide setiap indeks kelipatan 5; kartu pertama jauh lebih besar dan judul lebih dominan. Sulit membandingkan hasil. Metadata kecil/uppercase dan banyak garis menambah keramaian | Katalog grid berukuran konsisten; keunikan melalui komposisi foto/typography. Simpan varian editorial untuk pajangan, bukan ranking tersirat di hasil. |
| UX-06 | Sedang, source + browser | Filter provinsi dibentuk dari aset pada halaman saat ini + provinsi kantor seluruh BPRS. Bisa melewatkan provinsi aset di halaman lain atau mencampur kantor/aset. Free text desktop tidak dikomit lewat jalur yang sama dengan mobile | Tetapkan “Provinsi aset”; selaraskan perilaku ketik/pilih desktop-mobile, jangan mengklaim daftar lengkap. Solusi awal input provinsi dengan saran yang jujur; endpoint facet baru bukan bagian redesign tanpa bukti/izin. |
| UX-07 | Sedang, source | Filter hanya menampilkan jumlah aktif; error katalog menghilangkan kontrol. Cursor next mengganti halaman; hitungan hanya halaman aktif | Chip filter aktif, ringkasan hasil lokal yang benar, opsi reset dan ubah pencarian tetap terjangkau. Label pagination sesuai perilaku, tanpa total/pages rekaan. |
| UX-08 | Sedang, visual | Galeri mendahului judul mobile; spesifikasi dan panduan cukup panjang. Footer besar pada setiap halaman | Kenalkan judul/lokasi/penerbit lebih awal, prioritaskan spesifikasi, ringkas panduan/footer; ukur sticky WA agar tidak menutup konten. |
| UX-09 | Sedang, source + visual | Copy seperti “Indeks klasifikasi”, proses admin menerbitkan, dan “Tidak ada aset contoh ...” mengarah ke logika internal. Kategori Tanah/subtipe Tanah berulang | Bahasa publik sederhana; bedakan kategori/subtipe hanya bila berbeda; deskripsikan tindakan pengunjung, bukan sistem admin. |
| UX-10 | Sedang, source | Belum ada palette E, Manrope/Source Sans 3, ataupun tiga pilihan tema. CSS bertumpuk membuat judul tetap besar walau override baru sudah ditambahkan | Token semantik dan pemilik style yang jelas, migrasi per komponen, uji computed style dan seluruh portal/error. |
| UX-11 | Sedang, source + browser | Logo rail sekarang `data-direction=left`, transform -50%: gerak kanan ke kiri, tidak sesuai brief terbaru. Pause dan reduced motion sudah bekerja | Balik gerak jadi kiri ke kanan, pertahankan pause/focus/reduced motion dan tautan profil; tidak perlu library marquee baru. |
| UX-12 | Risiko skala, source | `listAllPublicInstitutions` mengambil seluruh halaman BPRS secara berurutan hingga batas keselamatan. Daftar filter dapat menjadi berat saat jumlah penerbit besar | Ukur dengan dataset representatif dahulu. Optimasi lokal/caching harus mempertimbangkan kesegaran visibilitas; perubahan API perlu persetujuan terpisah. |

Tidak ditemukan overflow horizontal halaman pada 18 view yang diukur. Bagian carousel/rail yang sengaja terpotong bukan overflow dokumen. Tidak ada pageerror atau console error pada navigasi normal yang dicatat. Ini bukan sertifikasi aksesibilitas maupun jaminan semua resolusi/perangkat.

## 6. Sistem visual yang diusulkan

### Warna dan tema

Palet E tetap menjadi keputusan utama. Tabel berikut adalah usulan token pelengkap, **belum diterapkan**.

| Peran | Terang | Gelap |
| --- | --- | --- |
| Background / surface | `#F6F7F3` / `#FFFFFF` | `#151925` / `#222A3C` |
| Teks utama / sekunder | `#20283D` / `#586176` | `#EEF1F5` / `#B7C0D0` |
| Aksen identitas | Indigo `#343F72`, sage `#CBD6BF` | Indigo tetap identitas; sage/warna terang untuk aksi yang perlu kontras |
| Primary button bg / teks | `#343F72` / `#FFFFFF` | `#CBD6BF` / `#151925` |
| Primary hover / pressed | `#29335E` / `#222B50` | `#DCE5D2` / `#B9C9AD` |
| Border dekoratif | `#DDE2D9` | `#3B465D` |
| Border input/kontrol | `#778273` | `#7E8BA3` |
| Focus ring | `#343F72`, offset kontras surface | `#CBD6BF`, offset kontras surface |
| Disabled bg / teks | `#E6E9E2` / `#66705F` | `#31394A` / `#AAB2C2` |
| Badge Tersedia bg / teks | `#E7EEE2` / `#3E5435` | `#2E402F` / `#D6E5C8` |
| Pesan error bg / teks | `#F9E9E7` / `#993B38` | `#472D31` / `#FFC8C1` |

Hitungan kontras sRGB lokal: teks utama/chalk 13,63:1; sekunder/chalk 5,76:1; putih/indigo 10,00:1; teks gelap/sage 11,61:1; teks utama dark/surface dark 12,66:1; sekunder dark/surface dark 7,83:1; badge tersedia light 7,02:1 dan dark 8,41:1. **Sage di atas chalk hanya 1,40:1: jangan dijadikan teks atau outline kontrol tanpa kontras tambahan.** Border dekoratif bukan otomatis border kontrol yang cukup terlihat.

Target penerimaan: teks normal >=4,5:1, teks besar >=3:1, indikator kontrol/focus >=3:1 terhadap warna yang bersebelahan. Uji pasangan aktual termasuk hover, pressed, opacity, ikon, dan overlay foto, bukan hanya tabel token. Warna status selalu disertai label, bukan titik warna saja.

Theme selector memiliki label Terang, Gelap, Ikuti perangkat. Preferensi tersimpan, mengikuti perubahan OS hanya pada mode perangkat, sinkron antar-tab, dan tidak flash ke tema yang salah/hydration mismatch. Jika storage tidak tersedia, UI tetap dapat digunakan. Mode gelap bukan invert foto/logo; logo memiliki alas netral bila diperlukan agar identitas asli tetap terbaca.

### Tipografi, layout, dan komponen custom

- Manrope untuk heading; Source Sans 3 untuk isi/form/tombol. Self-host WOFF2 melalui mekanisme paket/font lokal yang cocok dengan Next terpasang. Fallback heading `Arial, sans-serif`; isi `"Segoe UI", Arial, sans-serif`. Periksa lisensi, glyph Indonesia, fallback metrics, loading lambat, dan kegagalan font. Jangan menambah font dekoratif ketiga tanpa kebutuhan.
- Target body 16 px, form 16 px, metadata penting 14 px; heading halaman bukan poster. H1 katalog 28–36 mobile / 36–44 desktop; hero 36–44 mobile / 48–56 desktop. Skala ini titik awal yang diverifikasi visual, bukan alasan semua heading harus sama.
- Layout maksimum sekitar 1200–1280 px; mobile gutter 16–20 px; spacing sistem 4/8/12/16/24/32/48. Hindari whitespace besar yang tidak membantu kelompok informasi.
- **Kartu katalog:** foto 4:3; kategori/subtipe singkat; badge status nyata; judul 18–20 px; lokasi; baris penerbit; aksi Lihat detail dan Lihat ringkas terpisah secara semantik. Referensi/jumlah foto tidak bersaing dengan judul. Tidak ada harga, rating, favorit palsu, badge populer, atau spesifikasi yang tidak ada dalam DTO.
- **Kartu pajangan:** komposisi foto landscape 3:2 dengan caption di panel samping/bawah yang tegas; mobile menjadi susunan vertikal. Boleh asimetris di beranda, tetap memakai data publik dan link langsung ke detail. Tidak menjadi kartu katalog yang diperbesar secara acak.
- **Kartu/row BPRS:** logo asli object-fit contain, nama dan lokasi kantor jelas, jumlah publikasi dari API, link profil. Bentuk ringkas pada direktori; identitas yang sama di detail/dossier. Bukan statistik/kepercayaan rekaan.
- Buttons memakai label kerja jelas: Cari aset, Lihat detail, Lihat ringkas, Hubungi BPRS via WhatsApp. Primary satu per konteks; secondary outline/text dengan affordance jelas. Tidak semua aksi dibuat pill dan diberi ikon panah.
- Keunikan berasal dari foto nyata, komposisi, tipografi, pengelompokan informasi, dan ritme warna indigo/sage; bukan gradient dekoratif besar, glassmorphism, glow, orb, atau efek 3D generik.

### Peta komponen untuk dipertahankan/dikembangkan

| Komponen | Keputusan |
| --- | --- |
| `SiteHeader`, `SiteFooter`, `BrandLockup` | Refactor presentasi; tambahkan ThemeControl dan skip link, pertahankan navigasi/brand asli. |
| `PublicMotionProvider`, `public-motion.ts` | Jadikan pusat motion; jangan menambah engine kedua. |
| `PublicMedia`, media proxy, `BprsMark` | Pertahankan kontrak dan validasi, sesuaikan permukaan/fallback untuk tema. |
| `AssetCard` | Refactor custom layout; pisahkan varian catalog dan showcase eksplisit. Tidak menambah fetch per kartu. |
| `CatalogClient`, `CatalogCombobox` | Pertahankan URL state, Radix/React Aria; benahi draft/clear, active chips, kesetaraan desktop-mobile. |
| `AssetDossier`, `MediaLightbox` | Pertahankan quick view, retry, focus lock/restoration, sharing; selaraskan visual. |
| `AssetDetailGallery` | Pertahankan PhotoSwipe, thumbnail, keyboard, zoom, dan reduced motion. |
| `HeroAssetCarousel` | Pertahankan Embla manual, tanpa autoplay; satu data tidak menampilkan kontrol palsu. |
| `BprsMarquee`, CSS module | Revisi arah/kecepatan, integrasi tema, perilaku sedikit data. |
| `BprsDirectory`, profil | Refactor identitas dan kepadatan; pertahankan query/pagination/scoped catalog. |
| `InterestJourney` | Ringkas copy dan layout, pertahankan batas peran website. |
| Komponen baru terbatas | ThemeControl/ThemeProvider, ActionLink/Button presentation, AvailabilityBadge, FilterChip, shared PublisherIdentity/WhatsAppAction jika mengurangi duplikasi. Nama final mengikuti konvensi repo; tidak perlu framework design system baru. |

### Motion yang layak

1. Logo BPRS **kiri ke kanan**: track -50% menuju 0 atau teknik ekuivalen seamless; kecepatan stabil, uji titik loop. Pertahankan pause manual, hover, focus, dan duplikasi aria-hidden/non-tabbable. Jumlah/identitas selalu dari data asli. Untuk nol logo: tidak ada rail. Untuk satu/sangat sedikit BPRS: usulan tile statis agar tidak terkesan banyak mitra; konfirmasikan bila pengguna tetap menghendaki pengulangan visual.
2. Hover kartu desktop: perubahan border dan pergeseran ringan <=2 px; zoom foto sangat halus maksimal sekitar 1,02. Touch tidak memerlukan hover untuk melihat aksi.
3. Tombol: feedback pressed singkat 120–180 ms, focus terlihat; jangan membuat CTA WhatsApp berdenyut terus-menerus.
4. Filter/dialog: 180–240 ms opacity/geser kecil, focus langsung tepat; exit tidak menghambat tindakan.
5. Pergantian hero/foto oleh pengguna: transisi 180–280 ms; tidak berpindah otomatis ketika sedang dibaca.
6. Reveal bagian nonkritis sekali saja, jarak kecil; hasil pencarian, heading, dan CTA utama tidak menunggu scroll animation untuk dapat digunakan.
7. Loading: skeleton sesuai ukuran konten, opsional pulse lembut; tidak ada shimmer agresif. Reduced motion menampilkan state statis dan mematikan pergeseran, zoom, loop, pulse, dan smooth scrolling nonesensial.

Tidak perlu parallax, scroll-jacking, cursor custom, background partikel, counter statistik animasi, atau page-transition yang menghalangi Back dan pemulihan scroll.

## 7. Urutan pekerjaan dan kriteria penerimaan

Urutan ini adalah rencana, bukan izin mengeksekusi semua tahap. Mulai tiap tahap hanya ketika diminta, baca progres/diff terbaru, batasi perubahan, verifikasi, lalu berhenti untuk handoff.

| Tahap | Ruang lingkup konkret | Dependensi dan kriteria penerimaan |
| --- | --- | --- |
| 1 — Audit | Dokumen ini, baseline source/browser, gap data | Source dan fixture diperiksa. Gate runtime asli masih terbuka karena 4411/4410 tidak aktif. Tidak ada implementasi visual. |
| 2 — Fondasi visual dan tema | Token E, font Manrope/Source Sans 3, tiga pilihan tema, focus/disabled/status, ownership CSS | Dokumentasi Next lokal dibaca; font tersedia/lisensi jelas atau fallback dilaporkan. Tema bertahan reload, mengikuti OS sesuai pilihan, tidak flash/hydration error; portal/error/fallback ikut tema. Kontras pasangan aktual lulus. Belum rombak seluruh halaman. |
| 3 — Navigasi dan shell | Header, menu mobile, footer ringkas, skip link, penempatan kontrol tema | Keyboard/Escape/focus restoration lulus; header tidak menutup heading/anchor; 320–1440 tidak overflow; label Katalog/BPRS/Panduan dipahami. Struktur URL tetap. |
| 4 — Kartu dan identitas | Catalog card, showcase card, publisher identity, badge nyata, button variants; pasang pada pemakai yang ada | Kartu tetap link detail + tombol quick view terpisah; tidak ada nested interactive controls; nama panjang/media gagal aman; 1/5/24 item tidak diberi ranking rekaan; tanpa fetch detail per kartu. Foto/tipografi menjadi pembeda, bukan tambahan dekorasi. |
| 5 — Katalog dan pencarian | Compact header, URL/draft state, perbaikan clear, filter chips, lokasi konsisten, sort/cursor, empty/error | Repro UX-02 lulus; batal mobile tidak menerapkan draft, Terapkan mengubah URL; Back/Forward memulihkan pilihan. Filter/sort mereset cursor. Pada 390×844 awal gambar hasil <=520 px dalam state normal. Lebih dari 24 item diuji fixture terisolasi/real lokal sebelum klaim pagination lulus. |
| 6 — Beranda | Satu pembuka search/kategori, showcase custom, aset terbaru, BPRS, panduan ringkas | Tidak ada kategori ganda atau proses admin sebagai langkah pengunjung. Search langsung menuju katalog, kartu langsung detail. 0/1/2/banyak data jujur; kartu/showcase asli lebih mudah ditemukan. Hero tetap manual. |
| 7 — Detail, quick view, WhatsApp | Susunan informasi/galeri, spesifikasi, publisher, shared contact presentation, return context | Galeri 1/banyak, keyboard, zoom, close/focus lulus; data parsial tidak mengarang spesifikasi. Semua CTA memakai URL detail yang sama; pesan kode/judul dan penerima diperiksa tanpa mengirim. Kembali menjaga filter; direct URL aman. Sticky WA tidak menutup isi/footer atau tombol saat keyboard mobile terbuka. |
| 8 — Direktori/profil BPRS | Kartu/row identitas, search konsisten, scope aset BPRS, pagination direktori | Lokasi kantor dibedakan dari aset; jumlah dari API, bukan panjang array. Profil 0/1/>24 aset punya jalur benar ke katalog BPRS; logo tidak terdistorsi pada light/dark. |
| 9 — Panduan dan copy | Tiga langkah singkat, FAQ terbatas bila berguna, disclaimer dan label state yang manusiawi | Orang awam bisa menjelaskan cara menemukan aset dan menghubungi BPRS tanpa dibimbing. Tidak ada form harga/jadwal/bid/login. Panduan tidak mengesankan pesan otomatis terkirim atau penjualan pasti. |
| 10 — Motion dan state lintas halaman | Logo kiri→kanan, transisi mikro, reduced motion, loading/empty/error/offline/404 seragam | Loop tidak meloncat; pause/focus/reduced motion lulus. State tidak menyisakan area kosong tak dapat digunakan. Tidak ada konten utama disembunyikan menunggu animasi; no motion tetap nyaman. |
| 11 — QA menyeluruh dan handoff | Regresi browser, visual seluruh tema, keyboard, performa, data asli lokal, dokumen akhir | Seluruh gate di bawah disertai bukti; masalah tersisa diberi prioritas. Build berhasil saja bukan “website selesai”. Tidak commit/push/deploy tanpa permintaan baru. |

## 8. Verifikasi tahap 1

| Pemeriksaan | Hasil dan batas |
| --- | --- |
| `npm run build` | PASS. Produksi Next terkompilasi, type validation dan route generation selesai. Tidak membuktikan upstream asli hidup. |
| `tsc --noEmit --incremental false` | PASS. Pemeriksaan TypeScript website sesuai tsconfig; bukan typecheck seluruh backend. |
| ESLint pada `app tests scripts/run-browser-tests.mjs playwright.config.ts` | PASS. Ini lint terarah, bukan `npm run lint` seluruh monorepo. |
| `node --test tests/rendered-html.test.mjs` | 33 subtest PASS pada harness fixture. Mencakup render/data states/proxy dan sejumlah kontrak source. Harness ditahan sementara untuk audit browser. |
| Playwright existing suite | 5/5 PASS: hero manual, quick view/scroll lock/focus, filter mobile Escape, PhotoSwipe buka/tutup, error API tanpa kartu palsu. |
| Browser visual tambahan | 18/18 view normal memberi 200, tanpa document horizontal overflow dan tanpa pageerror/console error tercatat. Screenshot ditinjau untuk beranda, katalog, detail, direktori/profil BPRS, panduan, dan filter mobile. |
| Interaksi tambahan | Menu mobile setelah hydration buka/Escape/focus PASS; filter draft batal vs terapkan PASS; search query dan sort URL PASS; clear draft menemukan UX-02; tautan kembali dan WA diperiksa. |
| Logo | Pause mengubah paused=true; reduced motion animation-name=none dan tombol pause disembunyikan. Arah source/data masih left, belum sesuai brief. |
| State tambahan | Browser no-results dan 404 teramati; timeout/loading/fallback lainnya diperiksa dari source dan tes render, tidak semuanya diinstrumentasi browser secara mandiri. |
| URL 4411/API 4410 | BELUM DAPAT DIVERIFIKASI: listener tidak aktif, 4411 connection refused. |
| Data nyata/WhatsApp nyata | BELUM DIVERIFIKASI. Hanya sumber pemetaan dan href fixture; tidak ada pesan dikirim. |
| Git dan cleanup | `git diff --check` PASS; tracked diff tetap 24 file / 332 insertions / 96 deletions dari pekerjaan sebelumnya. Server fixture dihentikan; PID harness/child dan listener 65518 tidak lagi ada. 4411/4410 tetap tidak aktif. |

Eksplorasi screenshot pertama perlu diulang karena smooth scroll belum memicu seluruh reveal; ini artefak pengambilan gambar, bukan bukti area beranda kosong. Runner eksplorasi berikutnya sempat timeout membuka menu terlalu awal; pengujian terpisah setelah hydration berhasil. Simpan hasil mentah apa adanya, gunakan `interactions.json` untuk hasil uji interaksi lanjutan, dan jangan melabeli seluruh runner eksplorasi sebagai PASS.

### Keterbatasan dataset

- Informasi sebelumnya dari pengguna menyebut satu aset Ruwang Demo dan media berupa logo. Database itu tidak dibaca ulang: tidak boleh dianggap baseline representatif semua BPRS.
- Fixture audit memakai 5 aset, 5 BPRS, 3 foto detail. Gambar WebP sintetis yang sama dipakai berulang untuk foto/logo; kotak warna pucat pada screenshot adalah media fixture, bukan bukti foto nyata hilang atau logo asli salah.
- Endpoint detail fixture hanya mengimplementasikan `SJ-TEST0001`, profil hanya BPRS pertama. Detail/profil lain yang 404 dalam fixture tidak membuktikan bug route aplikasi.
- List fixture memakai photo_count contoh 1 walau detail dapat 3; ketidaksamaan ini bukan temuan produksi. Search fixture mencari JSON luas dan bukan ekuivalen penuh pencarian API database; query Rumah bisa cocok dengan metadata foto semua kartu.
- Fixture next_cursor selalu null dan tidak mengimplementasikan sorting aktual. Sort URL bisa diuji, urutan hasil/pagination produksi belum terbukti.
- Foto asli horizontal/vertikal, logo transparan/gelap/panjang, deskripsi dan spesifikasi masing-masing kategori, nama BPRS sangat panjang, volume >24 aset dan >24 BPRS, serta koneksi lambat nyata masih perlu diuji.

## 9. Gate QA bersama untuk tahap implementasi

1. Responsive: 320/390/430 mobile, tablet 768/1024, desktop 1280/1440; tambah Firefox/WebKit atau perangkat Safari nyata sebelum klaim lintas browser. Zoom 200%, teks panjang, keyboard virtual, safe area sticky CTA, tidak ada horizontal overflow.
2. Tema: Terang/Gelap/Ikuti perangkat pada semua route, dialog, gallery, select/popover, loading/error/404; reload, perubahan OS, storage gagal, no hydration error.
3. Aksesibilitas: heading/landmark/label benar, skip link, focus visible, Tab/Shift+Tab/Escape/arrow keys, modal trap/restoration, target interaksi praktis >=44×44 px, status tidak hanya warna, reduced motion. Screen reader smoke test; bukan hanya scanner otomatis.
4. Alur: home search/category → catalog → detail → href WA; tanpa quick view kedua (amendemen tahap 3); BPRS → profile → scoped catalog → detail; Back/Forward/refresh/deep link mempertahankan konteks yang semestinya.
5. Data: 0/1/2/5/24/>24, semua kategori, media hilang/metadata invalid, profile tanpa publikasi, service timeout/error, no-results, bad cursor/not-found. Gunakan fixture terisolasi; dilarang menambah demo ke publik.
6. Kinerja: catat baseline dan setelah perubahan untuk JS/font/media, CLS, LCP, INP pada kondisi yang sama. Sasaran awal CLS <=0,1, LCP <=2,5 detik, INP <=200 ms dengan kondisi pengukuran dinyatakan; belum diukur pada tahap 1. Jangan menilai foto sintetis berukuran sangat kecil sebagai performa produksi.
7. Integritas: sumber status/foto/nomor WA tetap DTO publik; tidak muncul harga/jadwal/bidding/payment/login/lead form, data internal, statistik palsu, atau label verifikasi rekaan.
8. Quality: tes relevan, TypeScript, lint sesuai scope, production build, git diff --check, review diff agar perubahan pengguna tidak hilang. Ekspektasi screenshot boleh diperbarui setelah review; assertion perilaku tidak dilemahkan agar tes sekadar hijau.

## 10. Dependensi yang masih terbuka dan handoff

- **Runtime asli:** pemilik lingkungan perlu mengaktifkan layanan lokal 4411 dan upstream 4410 menggunakan konfigurasi yang benar. Identifikasi proses/working directory lagi sebelum memulai layanan; jangan menebak credential atau menjalankan worker/DB/migrasi untuk audit UI.
- **Data representatif:** konfirmasi akses read-only ke data lokal yang sesuai, termasuk foto aset sungguhan dan beberapa BPRS. Tidak perlu menambah data ke publik. Sampai tersedia, keputusan fotografi dan integrasi nyata tetap provisional.
- **Font:** pengadaan Manrope/Source Sans 3 lokal pada tahap 2 beserta fallback; belum menginstal paket pada tahap 1.
- **Filter provinsi dan skala:** putuskan perilaku input berdasarkan kontrak saat ini. Facet lengkap/card specs/opsi status tambahan hanya dibahas bila ada kebutuhan produk dan perubahan kontrak yang disetujui.
- **Motion sedikit logo:** usulan statis ketika hanya satu BPRS perlu dicocokkan dengan preferensi pengguna; arah kiri→kanan untuk rail bergerak sudah tetap.
- **Uji awam:** belum ada sesi dengan pengguna nonteknis. Lakukan uji tugas singkat menemukan kategori/lokasi, membaca status, dan menemukan WhatsApp; catat kebingungan, bukan hanya penilaian “bagus”.

Dokumen kerja pendamping: `REDESIGN_PROGRESS.md`. Handoff berikut yang direncanakan adalah tahap 2 (fondasi visual/tema), hanya setelah pengguna memintanya. Gate integrasi asli tetap terbuka meskipun pekerjaan fondasi nantinya dapat diuji dengan fixture.

### Amendemen urutan — 14 September 2026

Bagian audit di atas adalah baseline historis, bukan status implementasi terkini. Tahap 2 fondasi dan tahap 3 shared components/navigasi sudah diimplementasikan; kartu katalog dan pajangan masuk **tahap 3 sesuai instruksi terbaru**, tidak lagi menunggu tahap kartu terpisah. Quick-view dihapus dari alur kartu publik. Peta komponen di SHARED_COMPONENTS.md, hasil verifikasi dan batas integrasi di REDESIGN_PROGRESS.md. Tahap 4 beranda belum dimulai karena pesan terakhir meminta menuntaskan tahap 3. Jangan menggunakan penomoran usulan audit lama untuk mengulang pekerjaan atau melewati verifikasi yang terbuka.

### Lokasi bukti

Pembaruan tahap 9 — 14 September 2026: audit visual dan sembilan koreksi frontend lokal telah dituntaskan. `VISUAL_AUDIT.md` adalah laporan kondisi aktual, `output/playwright/STAGE9_EVIDENCE.md` indeks bukti, dan handoff teratas `REDESIGN_PROGRESS.md` memuat gate/batas. Matriks 310 view memakai lebar CSS terukur; fixture tetap terisolasi. Jangan menganggap audit lokal membuktikan data asli, native mobile/browser lain, atau kesiapan produksi.

Pembaruan tahap 8 — 14 September 2026: tahap 6 detail/WhatsApp dan tahap 7 BPRS/bantuan sudah memiliki handoff sendiri; tahap 8 motion kini diimplementasikan sesuai urutan permintaan pengguna, bukan nomor usulan audit historis. Marquee lama dari tahap 4 diganti pengukuran kapasitas layar, loop kanan tanpa reset fokus, clone non-Tab, serta reduced motion statis. `MOTION_REDESIGN.md` dan handoff teratas `REDESIGN_PROGRESS.md` adalah acuan motion saat ini; gate integrasi data asli dan uji pengguna tetap terbuka.

Pembaruan tahap 5: katalog ringkas, filter draft yang konsisten, chip URL, pagination manual dan konteks kembali detail telah diimplementasikan. Rincian di CATALOG_REDESIGN.md dan checkpoint tahap 5 REDESIGN_PROGRESS.md. Label filter desktop yang langsung menerapkan pilihan pada audit lama bukan lagi perilaku terkini. Tahap 6 belum dimulai setelah pesan pemulihan tahap 5.

Pembaruan setelah permintaan berikutnya: tahap 4 beranda telah diimplementasikan. `HOME_REDESIGN.md` memuat keputusan, `REDESIGN_PROGRESS.md` memuat verifikasi final. Beranda kini satu hero/pencarian, satu kategori ringkas, BPRS sesuai data, kartu terbaru, tiga langkah pengunjung, footer compact. Rel BPRS kiri-ke-kanan serta penanganan satu profil sudah masuk tahap 4; jangan mengulangnya dari daftar motion historis di atas.

Salinan deliverable dan screenshot berlabel fixture berada di workspace audit:

`C:\Users\falll\Documents\Codex\2026-09-13\https-seputarjaminan-ruwangarsip-com-https-seputarjaminan\outputs\`

`stage1-evidence/audit.json` berisi 18 view dan hasil eksplorasi termasuk timeout runner; `stage1-evidence/interactions.json` berisi uji lanjutan. Screenshot dinamai berdasarkan route dan lebar viewport. Seluruh bukti tersebut bukan screenshot deployment produksi.
