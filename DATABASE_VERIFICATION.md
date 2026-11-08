# OPS-02 — central database verification

2026-09-15. Scope: database structure, migration reproducibility and real runtime
role isolation. Approved UI and API contracts were not redesigned or changed.

## Outcome

Database checks passed on an isolated PostgreSQL **17.11** Docker cluster:

- `sj_ops02_20260915`: fresh historical 13 migrations, fixture tests exposing a
  constraint bug, then additive migration 14 and regression tests.
- `sj_ops02_20260915_fresh`: a second empty database, all 14 migrations applied
  from scratch, schema/status/checksum checks and the same runtime-role tests.
- Container `sj-ops02-pg-20260915`, new volume `sj-ops02-pg-20260915-data`, bound
  only to `127.0.0.1:55482`. No existing container/volume was reused or reset.
- Generated owner/runtime credentials are confined to private local files outside
  source. Test connections are gated by explicit target file, DB name, loopback
  port, container label, named volume, database marker and cluster system ID.
- The old `seputarjaminan_ci` at local 5432 remained read-only. Before/after
  fingerprints of all **29 public-schema tables**, including migration history,
  matched exactly. No changes to Ruwang Demo / SJ-MCU548R6, old roles or storage.

The test container is deliberately retained for inspection, with restart policy
`no`. Do not point normal website/API/worker profiles at it. Its SQL fixtures are
not public listings, and no API/worker was started against it.

## Actual correction and impact

The original `media_delivery_complete` CHECK could evaluate to SQL NULL when
delivery metadata was partially absent. PostgreSQL accepts NULL CHECK results;
therefore a PROCESSING media row could contain incomplete delivery fields.

`20260915120000_delivery_metadata_all_or_none` adds a separate CHECK requiring
`num_nonnulls(...) IN (0, 6)`. The original 13 migrations/checks are unchanged.
Existing value/format checks still apply; READY still requires all six fields.
No rows are rewritten, statuses repaired, or indexes added.

The migration adds the constraint NOT VALID, then validates it. Its deployment
preflight must find zero partial rows. Applying requires a brief ALTER TABLE lock
and a validation scan; schedule using the destination's actual size/load. If
validation fails, review the business records—do not automatically null/delete
them or mark migration success. A read-only check found zero partial rows in the
old local DB, **but the new migration was not applied there**. That DB now has
one pending migration relative to this source; this is intentional, not a reason
to run migration deploy on the operational workflow during OPS-02.

The immutable checksum checker now includes the reviewed 14th checksum, and the
DB verification gate expects 14 migrations plus the new validated constraint.
The existing 13 checksum values were not replaced. Prisma datasource-to-schema
diff returned exit 0 on both targets; raw SQL CHECK/partial-index invariants are
verified separately because not all are represented by the Prisma schema.

## Role and data boundaries

| Role | Expected access, verified with an independent real login |
| --- | --- |
| registry | SELECT only on authentication registry; zero private rows without context; only requested tenant in transaction; business/ops tables rejected |
| ingest | Tenant-scoped reads/writes; cross-tenant INSERT or moving a row denied; UPDATE/DELETE against another tenant affect zero rows |
| public | Public-state reads without tenant context; INSERT/UPDATE/DELETE and private table access denied |
| ops | Central cross-tenant operations by design; not a tenant login; restricted DML grants still enforced |
| worker | Central cross-tenant background access by design; no ownership, destructive publication DELETE, or key-material SELECT; only required key lookup columns |
| migration owner | Separate privileged test-cluster identity, owns schema; never passed as a runtime credential |

All five runtime login roles and their NOLOGIN groups are NOSUPERUSER,
NOBYPASSRLS, NOCREATEDB, NOCREATEROLE and NOREPLICATION. Direct **and effective**
membership are limited to the intended group. Runtime roles own no tables,
cannot create in public schema or assume owner. All 28 business tables have
enabled and FORCE RLS; `_prisma_migrations` is owner-only metadata.

Registry/ingest context is transaction-local. Tests verify clearing after both
COMMIT and ROLLBACK, and that setting `row_security=off` does not bypass FORCE
RLS. Tenant context is supplied by the authenticated API transaction, not an
unforgeable DB identity: a compromised ingest credential could set a different
tenant context. These tests do not claim isolation against stolen server credentials.

Public RLS on publications checks publication state, availability and confirmation
expiry. Full listing visibility additionally checks institution/profile/contact
and READY cover in `PublicService`. Table-level public-reader grants are not a
public HTTP DTO allowlist: API serialization still controls which fields leave the
service. Do not describe every internal column as inaccessible to the DB reader.

## Structure and tests

- **35/35 check groups on each database**, including 15 composite FK attempts
  that reference another institution. These fail independently of RLS (owner
  transaction checks), proving actual composite referential constraints.
- Source/reference uniqueness, media order uniqueness, invalid enums, phone and
  confirmation checks, state visibility, grants and ownership checked.
- A cover's partial unique index enforces **at most one**, not existence of one.
  Cover existence/readiness is required by the public query. Intermediate workflow
  states need not always have a cover. No incompatible exactly-one rule was added.
- **128 NULL combinations per database** verify PROCESSING all-or-none and READY
  all-six metadata. Each test mutation runs only in the isolated target, and
  negative cases/updates are rolled back.
- Catalog inventory records FKs, enums, indexes, validated constraints and grants.
  Denormalized projection `cover_media_id` and source identifiers are not newly
  given foreign keys; the application must maintain those projection relationships.
- Guard tests **2/2** reject implicit DATABASE_URL, old workflow DB name, wrong
  port/container and invalid marker without reaching mutation logic.
- Existing unit suites **52/52**, local config tests **17/17**, root lint and
  root/API/worker typechecks passed. Immutable migration checker **14/14** passed.
- No frontend production rebuild/browser matrix was run: no visual code or
  generated Prisma client shape changed. No Redis/scanner/HTTP ingest integration
  or worker loop was run as part of this database stage.

## EXPLAIN findings — not a production SLA

Each target has 200 synthetic institutions, 10,000 publications/search documents,
400 synthetic media rows and 4,000 inert jobs. Photos/files are not created.
Publication data includes unpublished, unavailable and expired cases. Fixtures
are intentionally uniform in some dimensions; category diversity, larger tenant
skew, cold cache, concurrency and production hardware remain unmeasured.

`PublicService` was called directly with Prisma's real public runtime connection.
Its emitted SELECT SQL and parameters were captured and run through
`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` with the same public role. No query
planner settings or indexes were changed to force a desired plan.

| Case | Final run, slowest SQL EXPLAIN execution (rounded) |
| --- | ---: |
| Catalog newest / next / oldest | 90 / 66 / 58 ms |
| Category + location + BPRS | 1 ms |
| Search selective / no match | 43 / 42 ms |
| Asset detail | under 1 ms |
| Directory with counts | 71 ms |
| Directory search + province | 1,022 ms |
| BPRS profile | 23 ms |

The directory-filter case took about 1.0–1.4 seconds across two local captures.
Its plan repeats the visibility/count aggregate under nested loops. Catalog list
queries load 11 SQL statements for included relations and perform visibility joins
before sorting. Selective search/no-match still visits many projection rows.
These are concrete optimization follow-ups; a new index alone has not been shown
to solve them. **No index was added speculatively.** This stage verifies behavior
and records plans, not nationwide capacity or acceptable p95 latency.

The worker's exact claim UPDATE SQL was also extracted from source and explained
under the real worker role inside a rolled-back transaction. No worker loop or
business job ran. Detailed plans and initial/final timings remain in ignored local
evidence, not the release candidate.

## Repeating safely and checkpoints

From `D:\seputarjaminan-production`:

```powershell
npm run test:database:guards
npm run ci:migrations:check
$env:SJ_OPS02_TARGET_FILE = 'D:\seputarjaminan-local\ops02\target-fresh.json'
npm run test:database:ops02
```

The verifier requires the existing labeled/marked isolated target and never
falls back to root `.env.local` or DATABASE_URL. Do not invoke
`ci:database:provision` on the old local DB: its historical CI-only name guard
assumes a disposable `seputarjaminan_ci`, which is false on this workstation.

Resume using ignored `work/ops-02/checkpoint.md`, not stale process IDs. Local
setup/fresh-migration scripts deliberately refuse existing targets rather than
resetting them. Their private files and container volume are retained, not added
to Git. Do not rerun creation after a disconnect; inspect the checkpoint/target
and migration status first.

Important evidence: `database-results.json`, `database-results-fresh.json`,
`database-results-before-fix.json`, `query-plans.json`, `query-plans-initial.json`,
fresh-migration/status/schema logs, and `old-before.json` / `old-after.json`.

## Remaining dependencies

Update 2026-09-16: local Redis/ClamAV, private ops configuration, external storage
and repository-audit follow-ups below are resolved in OPS_LOCAL_READINESS.md.
Directory filtered-count query now batches counts for the selected page only;
same-fixture measurements779–1540ms before,81–260ms after, identical response.
No schema/index/RLS change was used. This does not establish production capacity.
The old workflow database still intentionally has13 migrations; rollout of the
additive14th is NOT authorized by isolated testing and remains a deployment gate.

Historical OPS-02 completion boundary:

OPS-01 Redis/ClamAV/private-ops setup remains separate and unresolved. The additive
migration awaits later authorized operational rollout; backups/lock scheduling
and destination PostgreSQL-version verification are not proven by this 17.11
container. Existing repository audit failure referencing deleted PageIntro remains
outside OPS-02. No cross-repository change, commit, push, deployment or VPS action.

No new HTTP service was launched or URL exercised in OPS-02. The new listener is
PostgreSQL TCP 55482. Existing UI sample listeners were left untouched; they are
not evidence of real API/database integration.
