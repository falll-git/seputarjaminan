# Tahap 4 — beranda publik

> Catatan historis tahap 4. Pembaruan beranda yang disetujui pada 17 September 2026 menggantikan keputusan hero/manual-only dan sumber etalase di bawah. Lihat `HOME_SHOWCASE_REFINEMENT.md` untuk perilaku terbaru; catatan lama dipertahankan sebagai riwayat, bukan kontrak UI saat ini.

## Keputusan implementasi

- Satu hero: pengantar agunan BPRS → pencarian GET `/katalog?q=...` → visual publikasi dari API. Heading tunggal: “Temukan aset. Terhubung langsung.” Tidak ada panel pencarian terpisah, CTA duplikat, statistik, testimoni, atau penjelasan admin internal.
- `app/home.module.css` mengatur grid dua kolom desktop (copy/kategori di kiri, foto di kanan). Mobile menempatkan copy singkat, pencarian, kategori, lalu foto. Urutan ini sengaja menjaga pencarian/kategori mudah dijangkau tanpa melewati foto besar. Empat kategori berasal dari taxonomy sistem, bukan array pilihan rekaan; grid otomatis dua kolom, tidak ada indeks kategori kedua.
- `HeroAssetCarousel` sekarang hanya visual dan caption, bukan keseluruhan hero. Embla tetap manual (tombol/swipe/keyboard), tanpa timer/autoplay. Caption dan foto menuju publikasi yang sama. Satu aset tidak memiliki tombol pergantian; tanpa aset menampilkan state kosong atau gangguan yang sesuai, bukan media pengganti.
- Sumber daftar tidak berubah: `listPublicAssets({limit:7,sort:"NEWEST"})`, taxonomy, dan `listPublicInstitutions({limit:16})`. Tiga aset terbaru memakai `AssetShowcaseCard` tahap 3; 3/2/1 kolom sesuai jumlah/viewport, satu aset dibatasi lebar 640px dan ditengah. Tidak ada fetch detail tambahan untuk mengisi spesifikasi yang tidak tersedia dalam DTO.
- Label “BPRS dengan aset aktif” sesuai query `PublicService.listInstitutions`: institution/profile ACTIVE dan mempunyai publikasi yang memenuhi visibilityWhere. Bukan jumlah seluruh bank terhubung atau klaim aset siap dilelang. Tidak menampilkan total rekaan; API tetap sumber profil/logo/slug.
- Satu BPRS memakai identitas statis (logo, nama, lokasi, tautan profil), tanpa pengulangan. Dua atau lebih memakai rel logo yang ada, kini kiri-ke-kanan. Duplikasi untuk loop tetap aria-hidden/tabIndex=-1. Hover/jeda menghentikan gerak; reduced motion menampilkan daftar asli statis. Saat fokus keyboard masuk, transform dihapus dan rel dapat digulir agar tautan fokus tidak tersembunyi di luar viewport.
- Beranda menggunakan `SiteFooter compact` dari komponen bersama. Mode default halaman lain tidak diubah. Identitas layanan, tautan, dan keterangan BPRS tetap ada; pengulangan visual dan jarak berlebihan dipangkas.
- Panduan: Cari aset → Baca detail → Hubungi BPRS. Tautan panduan tetap `/cara-minat`; WA aktual tetap dari detail API, tidak ada nomor atau transaksi baru.
- Konten utama beranda tidak menunggu animasi reveal/hydration untuk terlihat. Motion ringan kategori, pergantian caption manual, dan rel logo mempertahankan kebijakan reduced motion. Token/font/tema tahap 2 tidak diganti.

## File dan batas

Source: `app/page.tsx`, `app/home.module.css`, `HeroAssetCarousel.tsx/.module.css`, `BprsMarquee.tsx/.module.css`, `SiteFooter.tsx/.module.css`. Tests: rendered/foundation dan ekspektasi heading browser existing. CSS lama yang tidak dipakai beranda tetap dipertahankan untuk menghindari penghapusan pekerjaan sebelumnya/efek route lain; bukan berarti section lama masih aktif.

Tidak mengubah backend, kontrak, dependency, environment, data produksi, kontak WhatsApp, atau menjalankan commit/push/deploy. Tidak melanjutkan tahap katalog/detail/direktori menyeluruh.

## Verifikasi dan batas bukti

Lihat checkpoint tahap 4 pada `REDESIGN_PROGRESS.md` untuk hasil final. Eksplorasi Playwright CLI: `work/stage4-qa.js` (port ephemeral disesuaikan setelah harness baru). Screenshot `output/playwright/stage4-{many,empty,single}-{light,dark}-{1440,390}.png`. Media bidang warna berasal dari fixture terisolasi, bukan foto produksi atau placeholder final yang dibuat untuk mengganti data nyata.

Keterbatasan tetap: upstream lokal 4410 belum tersedia, sehingga 4411 menampilkan gangguan yang jujur. Uji UI berdata menggunakan API fixture. Fixture hanya memiliki detail/profil pertama, tidak mendukung sorting/pagination penuh dan tidak membuktikan kualitas crop semua foto/logo bank, performa jaringan nyata, kontak WA nyata, Safari/Firefox/perangkat fisik, atau hasil uji pengguna awam.
