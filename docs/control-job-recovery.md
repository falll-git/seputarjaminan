# Recovery job privat dari Ruwang Control

`POST /v1/internal/ruwang-control/sj-jobs/recovery` nonaktif secara default.
Ini protokol integrasi privat, bukan endpoint publik/admin tanpa autentikasi.
Kontrak runtime: `apps/api/src/control-recovery-contract.ts`, handler:
`apps/api/src/control-recovery.ts`. Tidak memakai session OpsUser palsu.

## Konfigurasi eksplisit

Aktifkan hanya setelah target dan trust disiapkan secara sah:
`SJ_CONTROL_RECOVERY_ENABLED`, `SJ_CONTROL_RECOVERY_AUDIENCE`,
`SJ_CONTROL_RECOVERY_RESPONSE_KEY_ID`,
`SJ_CONTROL_RECOVERY_RESPONSE_PRIVATE_KEY`, `SJ_REDIS_URL`, dan
`SJ_CONTROL_RECOVERY_BINDINGS`. Binding adalah array JSON dengan
`instanceId`, `institutionId`, `installationId`, `keyId`, `publicKey`.
Setiap instance unik; key Ed25519. Tidak ada fallback trust dari monitoring.
Private key harus berasal dari konfigurasi rahasia, bukan contoh/source.

Institution dan installation harus aktif dan cocok. Job/media harus punya
provenance instalasi yang dicatat saat ingest/upload. Job lama tanpa provenance
tidak boleh diberi instalasi dari konfigurasi saat ini. Migration
`20261001001000_control_recovery_receipts` menambah audit append-only dengan
FORCE RLS; role ingest tidak mendapat UPDATE/DELETE audit.

## Request/response

Envelope berisi `contract_version:1`, `instance_id`, `audience`, `operator_id`,
`operation`. Operasi: list (`state`, `cursor`), detail (`job_id`), retry
(`job_id`, `request_id`, `expected_revision`, `reason`), receipt
(`request_id`, `request_digest`). Unknown field ditolak. Max body 4096 byte.
Daftar maksimal 25, ID ascending, cursor UUID, total tidak tersedia (`null`).

Transport Ed25519 `RUWANG-CONTROL-V1` mengikat POST, path, timestamp, nonce,
canonical payload SHA256. Redis menolak nonce berulang. Signature respons
mengikat request nonce/digest, operator, instance, institution, installation
dan waktu. HTTP200 saja tidak cukup. Hasil hanya metadata job, bukan payload,
ingest ACK, atau klaim publik tampil.

Retry hanya DEAD_LETTER tanpa lease untuk tiga jenis job yang didukung.
Revision mengikat keadaan/percobaan/lease/updatedAt dan asal job. Transaksi
mengunci job, melakukan conditional update, lalu menulis receipt dengan
previous_attempt_count. Duplicate request identik membaca receipt lama;
digest/actor/binding berbeda ditolak. Retry tidak mengganti payload/origin,
tidak membuka quarantine, dan tidak mengubah state media menjadi READY.
Scanner serta worker normal tetap menentukan hasil akhir.

Respons hilang bukan kegagalan pasti: baca receipt sebelum mengulang request
yang sama. `SCHEDULED` hanya penjadwalan, bukan selesai/tayang. Pengujian positif
harus memakai API/service nyata pada resource disposable; unit test double
bukan bukti integrasi aplikasi nyata.
