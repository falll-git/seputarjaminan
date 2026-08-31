-- Jalankan sebagai administrator database setelah group roles dari
-- bootstrap-group-roles.sql tersedia dan sebelum login runtime digunakan.
--
-- Izin schema dan tabel merupakan bagian migration yang terversi. Jangan
-- menduplikasinya di skrip provisioning karena perubahan terpisah dapat membuka
-- akses lebih luas daripada source aplikasi.

GRANT CONNECT ON DATABASE :"database_name" TO
  sj_registry,
  sj_public,
  sj_ingest,
  sj_worker,
  sj_ops;

-- Tidak ada GRANT ON ALL TABLES, default privilege, atau izin sequence di sini.
-- Seluruh primary key aplikasi memakai UUID dan migration baru wajib menambah
-- grant tabel secara eksplisit hanya jika source runtime benar-benar memakainya.
