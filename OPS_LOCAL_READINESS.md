# Local prerequisites before OPS-04

Scope: authorized Docker installation and completion of OPS-01..03 local holds,
2026-09-16. No visual redesign, cross-repo write, commit, push, deploy or VPS access.
This is NOT production readiness or completion of OPS-04.

Status: local prerequisite closure complete. Latest user instruction requires
waiting before OPS-04; that stage has NOT started. Historical pending entries in
checkpoints are superseded by their final closure sections.

## Services and configuration

| Service | Local target | Isolation |
| --- | --- | --- |
| Redis7.4.11 | 127.0.0.1:56380 | New authenticated container, dedicated AOF volume; noeviction;256MiB limit |
| ClamAV1.5.4 | Docker exec stdin only | Dedicated signatures volume, no published port or business-file mount;4GiB limit |
| PostgreSQL17.11 | 127.0.0.1:55482 | Existing verified OPS02 test container retained; separate new integration DB |

New containers: `sj-ops-local-redis-20260916` and
`sj-ops-local-clamav-20260916`. Restart policy is deliberately `no`; old containers
remain stopped and unchanged. Images are pinned to resolved SHA256 digests in the
private manifest. Manifest, password and configs are under
`D:/seputarjaminan-local/services`, restricted to operator+SYSTEM. Never print them.

Official image/streaming references:
[Redis Docker](https://redis.io/docs/latest/operate/oss_and_stack/install/install-stack/docker/),
[ClamAV Docker](https://docs.clamav.net/manual/Installing/Docker.html),
[ClamAV scanning](https://docs.clamav.net/manual/Usage/Scanning.html).

API/worker scoped profiles now use the new Redis; website still receives only its
public API origin. Worker uses explicit local `SJ_CLAMAV_DOCKER_CONTAINER`. Native
clamdscan remains default; Docker transport is rejected in production. Docker
daemon access belongs only to the local operator, not a model for VPS privileges.
Scanner startup proves a clean scan, not merely executable version. Data streams
in memory, including the harmless EICAR antivirus test string; no host EICAR file.
Stopped daemon, unknown output or failed transport fail closed.

API/worker remain development; all feature flags and normal worker remain OFF.
No old jobs consumed. Normal API/website4410/4411 were not launched by this task.

## Data protection

- Old `seputarjaminan_ci` on5432 is NOT disposable; no migration or workflow write.
- Original4 storage objects (836032bytes) copied with full SHA256 comparison to
  `D:/seputarjaminan-local/storage/local-media`; source retained. Both profiles
  switched after verification, with a1GiB free-space threshold. No synthetic test
  writes to either the original or copied operational objects.
- Missing local ops keys initialized only after live read-only zero-row checks
  for ops users/MFA/sessions/challenges/recovery codes. No existing key replaced,
  no bank Admin credential, no ops account bootstrapped. Private backup copies kept.
- Dedicated `sj_ops_prereq_20260916` DB and external `storage/integration-tests`
  directory have explicit markers. Docker identity/volume/port, PG system ID,
  database marker and all six credential targets are checked before mutable test.
  It is separate from BOTH old workflow and populated OPS02 performance databases.

## Verified behavior

- Redis correct/missing/wrong auth, PING, SET/GET/DELETE, expiry and restart
  persistence passed against the new marked container only.
- Actual worker scanner accepted PNG and rejected EICAR as MALWARE_DETECTED;
  stopped daemon and missing command rejected; restart with persisted signatures
  recovered. Freshclam updated signatures to28124 on this run.
- New empty integration DB: all14 migrations, status, Prisma schema diff and
  role/constraint checks passed; historical migration checksums not edited.
- Existing publication-flow regression now has guarded real-service opt-in:
  signed upload -> scanner -> WebP worker processing -> signed profile/contact/
  publication events -> list/detail/public image -> duplicate/replay rejection ->
  unpublish/profile hiding. Real Redis limiter and ClamAV, development config,
  real per-role DB clients. Test passed; WhatsApp href inspected only, never sent.
- Directory query uses one bounded count batch AFTER selecting the page; no
  per-card queries, no speculative index/security change. Same24 rows/counts/
  cursor: before1540/1237/779ms; after260/90/81ms in3runs. EXPLAIN evidence retained.
  Four-group OPS03 read-only regression also passed (7220eligible assets per sort,
  190institutions, invalids/hidden details/allowlist). Not a load test/SLA.
- Repository audit now understands tracked deletions while still rejecting secret
  patterns and missing required workflows. Deleted PageIntro was not restored.

Final gates: all19 commands in `final-gates.json` exit0: unit62 (contracts8/API33/
worker4/config14/storage3), local-config17, scanner/audit5, DBguards2, public-controls3,
foundation7, lint, root/API/worker typechecks, API/worker/Next production builds,
migration checksums14, contracts, rendered40, Chromium browser5, repository audit,
dependency readiness. Generated OpenAPI `--check` separately passed. No failed or
skipped tests in these completed suites. Real-service flow1 and service-check7groups
also passed. Deliberately wrong integration DB URL was rejected BEFORE mutation.

Final cleanup verifier: all26business tables in the new integration DB empty;
18taxonomy items+1taxonomy version are migration seed data, not leftover fixtures.
The test storage directory contains only its identity marker. Original and copied
storage still match; all29old workflow DB table fingerprints unchanged. No pending
environment writes;13private files ACL-checked, only operator+SYSTEM allowed.

### Files changed by this follow-up

- Scanner: `apps/worker/src/malware-scanner.ts`, new `clamav-command.mjs` and
  `clamav-command.d.mts`, `apps/worker/.env.example`.
- Config/runtime: `packages/config/src/server.mjs`, `server.d.ts`, config tests,
  `scripts/local-environment.mjs`, `scripts/local-runtime.mjs`.
- Directory: `apps/api/src/public-service.ts` and its unit test.
- Regression: `apps/api/tests/integration/publication-flow.test.ts`, new
  `real-local-services.ts`; new `tests/clamav-command.test.mjs` and
  `tests/repository-audit.test.mjs`; `scripts/audit-repository.mjs`, `package.json`.
- Guides: this file, LOCAL_OPERATIONS.md, DATABASE_VERIFICATION.md,
  PUBLIC_API_CONTRACT.md. Existing package-lock/user changes were preserved.
- Private configuration/backups and ignored checkpoints/harnesses are local only,
  outside release candidates. No secret values are copied into these guides.

## Recovery and evidence

Read `work/ops-prerequisites/checkpoint.md` before continuing. Local scripts/logs
are ignored and NOT release candidates. No database/container reset is needed.

After Docker Desktop starts, this guarded script rechecks labels/volumes/digests
and starts only the two owned services if stopped:

```powershell
node work/ops-prerequisites/provision.mjs
npm run local:check -- --dependencies
npm run test:local-prerequisites
```

Do NOT run the original env splitter or earlier configure-services script to
overwrite newer storage/ops profile edits. Normal worker launcher remains locked.
Restart PostgreSQL only after checking its existing OPS02 target metadata, as
documented in DATABASE_VERIFICATION.md. Retain all volumes and private manifests.

Evidence: services-results.json, storage-ops-results.json, directory-before/after.json,
integration-migrate/status/schema/roles.log, real-integration.log, final-gates.json
and final-*.log under the ignored prerequisite directory. On disconnect inspect
actual process/listener state before rerunning; never treat `START` as `PASS`.

## Still outside this local closure

Final browser spot check (separate fixture): http://127.0.0.1:59646/bprs,
/bprs/bprs-amanah-nasional and /aset/sj-test0001; desktop1440 light/mobile390 dark,
keyboard theme/Escape focus restore, mobile no overflow, console0errors/0warnings.
Screenshots viewed and kept under ignored output/playwright/ops03/prerequisites-*.
The fixture and browser session are now STOPPED, not a live preview. Current
4410/4411/59646 listeners absent; only testPG and new Redis/ClamAV remain running.
The deliberately invalid-target test has expected inner failure to prove denial
before mutation; it is not a remaining application failure.

- The additive14th migration is intentionally NOT applied to old workflow DB.
  Its operational rollout needs the later authorized backup/lock/target gate.
- VPS Redis/ClamAV installation, production secrets, native scanner access,
  backup/restore, cross-system bank integration and production/load/security
  acceptance are not established by this local run.
- Normal runtime gates remain locked until the appropriate next-stage plan.
  No persistent real ingestion or worker loop is running; tests exercised explicit
  `runOnce` processing in the marked integration environment only.
- Browser fixtures stay separate from real DB integration and are never normal
  website fallback data. No claim of all-browser/all-width visual re-audit.
