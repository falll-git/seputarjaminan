import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const migrationDirectory = fileURLToPath(new URL("../prisma/migrations/", import.meta.url));
const expected = new Map([
  ["20260822085806_init_central", "b34a6d21519d41433bc071831eabadb92e99fdddace610a9a0045fc9231ddf84"],
  ["20260822091000_central_rls", "bfb7d815069b616945843fc0c0f0f6fe09ce7856dfac330e38e4bdf97ba65ad7"],
  ["20260822092000_aggregate_cursor", "5cdeb4a9fa5fdebda1d5de597f4630ab9ab9bc784c3777c6bd9fff334b6e3fd5"],
  ["20260822093000_profile_mark_media", "40a857be60c98a691efa41e16152c097a3aecc3fefc52231ab4a162ae2f92e79"],
  ["20260822094000_media_delivery_and_worker_scope", "0786c04efc50fdc2f3ff9f50c5473018e0698ec85eb5637f7ed3910bc65185b2"],
  ["20260822095000_ops_auth_challenges", "56522058eeb82ad5e7fe47fdf25a7b06bff6260e2341a7d33092279280dedcae"], // gitleaks:allow -- migration SHA-256 checksum
  ["20260822096000_reversible_quarantine", "177b6e2ff0be6eed794c3258281fc051134accc9befda99b8e67f0724d0298d2"],
  ["20260822097000_registry_least_privilege", "eda4cae7adff4474604eabaef179a033e631cc4475d4dd752c2408328e024829"],
  ["20260822098000_media_purpose", "ee6884f8176626d1f1199b04b9d05af63a52d3f81925e45752aaa989aebdc8c6"],
  ["20260822099000_runtime_delete_least_privilege", "f99b7e63d2ef4fbf1c20573652d41ccec611baf0a8ffdea8b94ac7bdea66b9de"],
  ["20260822112000_seed_taxonomy_v1", "86a9e18957b721cf045ca03842fd8b3d5f8e370f76a17fb5be1970c46416d821"],
  ["20260823100000_complete_runtime_role_grants", "ad1c0064785f57fdfd5d06a1230c13bdc908b09166ed8e6f52103f5a67ce832b"],
  ["20260823110000_allow_worker_nonce_policy_lookup", "278588f4caf3c9e0c56f097ed64d28948c6bbc78705ecf6191ec8048663632f6"],
]);
const expectedLockHash = "99836963713b4f5b269ad49af0ed3d7b0b2e336115c2f92dc9ac683d139d0900";

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

const directories = (await readdir(migrationDirectory, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

assert.deepEqual(directories, [...expected.keys()].sort(), "Daftar migration berubah; perbarui baseline hanya setelah migration baru ditinjau.");

for (const [directory, expectedHash] of expected) {
  const sql = await readFile(new URL(`../prisma/migrations/${directory}/migration.sql`, import.meta.url));
  assert.ok(sql.length > 0, `${directory}/migration.sql kosong.`);
  assert.equal(sha256(sql), expectedHash, `${directory}/migration.sql berubah dari baseline immutable.`);
  assert.doesNotMatch(sql.toString("utf8"), /^(?:<<<<<<<|=======|>>>>>>>)/mu, `${directory}/migration.sql memiliki conflict marker.`);
}

const lock = await readFile(new URL("../prisma/migrations/migration_lock.toml", import.meta.url));
assert.equal(sha256(lock), expectedLockHash, "migration_lock.toml berubah dari baseline.");
assert.match(lock.toString("utf8"), /^provider\s*=\s*"postgresql"\s*$/mu);
console.log(`Integritas migration valid: ${expected.size} migration PostgreSQL cocok dengan checksum baseline.`);
