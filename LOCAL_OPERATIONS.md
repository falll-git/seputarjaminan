# Local operational configuration (OPS-01)

This guide concerns local Seputar Jaminan only. It does not authorize database
provisioning, migration application, feature activation, deployment, or VPS work.
Keep the approved website visual unchanged.

## Per-process boundary

Local private profiles are in the sibling `seputarjaminan-local/config` directory
(on this workstation: `D:\seputarjaminan-local\config`). They are outside the
repository/release. Access must be restricted to the local operator and SYSTEM.
Do not copy these files or their contents into Git, logs, chat, or a release.

| Process | Profile | Credentials available to the child |
| --- | --- | --- |
| Website | website.env | Public API origin only; optional explicit loopback permission |
| API | api.env | Registry, ingest, public-read, ops DB logins; API Redis/storage/security settings |
| Worker | worker.env | Worker DB login; Redis/storage/scanner/heartbeat settings |
| Migration/owner | migration.env | DATABASE_URL only |

`scripts/local-environment.mjs` is the explicit key allowlist and validation
contract. Local API role logins must be different; worker and owner cannot reuse
them. All profiles must refer to the same local DB/storage/Redis configuration.
The dependency check verifies PostgreSQL role membership and elevated role flags
using read-only connections. This is not a comprehensive privilege/RLS audit.

The child environment retains only necessary OS variables plus its own profile.
Inherited DATABASE_URL, SJ flags, cloud credentials, NODE_OPTIONS and NODE_ENV
are not forwarded implicitly. A runtime launch reads only its own profile;
the separate diagnostic check intentionally reads all profiles to compare them.
These are process-environment boundaries, **not** isolation between Windows users:
processes launched by the same operator can access that operator's private files.

## Loading behavior and commands

Run from the repository root:

```powershell
npm run local:check
npm run local:check -- --dependencies
npm run local:migration:status
npm run test:local-config
```

- `local:check`: syntax, scope, cross-process consistency, disabled feature gates,
  and website `.env*` contamination. Does not print secret values.
- `--dependencies`: adds PostgreSQL read-only role queries, Redis PING, and
  a clean-byte scan through the actual worker scanner transport. Returns failure
  if unavailable. This readiness command does not itself run an infected-file test;
  the separate guarded service verification does (see OPS_LOCAL_READINESS.md).
- `local:migration:status`: only `prisma migrate status`, with the owner profile.
  No deploy/dev/reset SQL action is exposed. Dependency output is not echoed.
- `local:website`: Next development website on loopback 4411 with website-only
  env. Do not start alongside a Next build/preview if their output directories
  would conflict; the sample preview is the current review surface.
- `local:api`: API on its explicit loopback port (currently 4410), after Redis
  and four DB role preflights. It will not start without these prerequisites.
- `local:worker`: intentionally refuses to start in OPS-01, even after Redis or
  ClamAV becomes available. No old job consumption or maintenance is permitted.

The plain root `dev/build/start` scripts retain Next's built-in `.env*` loading.
Root `.env.local` must contain website configuration only; do not pin NODE_ENV
there. Next chooses development for `dev`, production for `build/start`.
The local website launcher rejects non-website keys in all root auto-load files.

API/worker workspace `dev/start` are low-level entrypoints: they read
`process.env`, **not** `.env.local`. Use the scoped local launchers on this
workstation. Existing production entrypoints still require externally injected
per-process environment; local wrappers are not a production process manager.

Prisma's `import "dotenv/config"` reads `.env`, not Next's `.env.local`.
The status wrapper explicitly supplies only the migration profile. Do not run
owner tools in the same inherited environment as the website/API/worker.

## Safe local state and infrastructure

API/worker remain `NODE_ENV=development`. The worker scanner is `CLAMAV`, never
`TEST_SAFE`; TEST_SAFE remains confined to isolated automated tests. Local checks
lock public publication, ingest, media upload, Control monitoring and worker
activation off. They do not change publication records or database statuses.

The existing database named `seputarjaminan_ci` contains a prior workflow. Its
name does not make it disposable. The current credentials and storage locations
were preserved, not replaced with a new/empty/test database. Mutative integration
tests must wait for a separately verified database AND storage target.

Initial OPS-01 infrastructure hold was resolved in the authorized 2026-09-16
prerequisites follow-up. Authenticated Redis now uses loopback56380, its own
persistent volume and AOF. Legacy Redis56379/container/data remain untouched.
ClamAV uses a separate Docker container with persistent signatures, NO published
TCP port and NO application-data mount. `SJ_CLAMAV_DOCKER_CONTAINER` is an explicit
worker-only local selector; bytes stream to `docker exec -i ... clamdscan` stdin.
The selector is rejected in production; VPS uses native `SJ_CLAMDSCAN_COMMAND`.
Docker access is privileged host capability granted to the local operator, not a
production worker deployment pattern. Neither TEST_SAFE nor AllowAll substitutes
is used by the real-service integration test. See OPS_LOCAL_READINESS.md for
startup/recovery, identities, evidence and remaining rollout boundaries.

Ops MFA/session secrets are separate API-only settings. If they are absent,
private operations stay unavailable; do not generate replacement encryption keys
for an existing workflow without checking whether previously encrypted data
depends on the old key.

The follow-up read-only check found zero existing ops users, MFA factors, sessions,
auth challenges and recovery codes. Only then were the missing LOCAL keys generated
and stored in private files; no account was created and no key was replaced.
All4 existing storage objects were checksum-verified copied to external persistent
storage and scoped profiles switched together; original objects remain untouched.
Do not rerun the original splitter after intentional profile updates.

## Sample preview remains separate

`node work/sample-preview.mjs` is an ignored, local-review-only launcher. It reads
sample files, never a DB. Its Next child now receives only website configuration.
The normal website API origin stays 4410; it never falls back to the sample API.

- Review wrapper: http://127.0.0.1:4433/ (SIMULASI LOKAL banner retained).
- Sample website: http://127.0.0.1:4432/.
- Sample API: http://127.0.0.1:4431/.
- WhatsApp remains disabled for samples. Samples are not real BPRS/publications.

Do not start a second preview if these listeners already exist. Avoid rebuilding
`.next` under the running production preview. Restart only identified SJ
processes; do not kill Node/Docker/PostgreSQL indiscriminately.

## Splitting/recovery

`scripts/split-local-environment.mjs` is the one-time local conversion utility.
It validates the whole split, preserves exact credentials in a private backup,
forces activation off and CLAMAV, and replaces root `.env.local` only after all
four profiles exist. Same content is idempotent. Divergent source/profile or
incomplete pending-file content causes a stop for review, never a blind overwrite.
Literal dotenv values are round-trip checked without interpolation. Unsupported
multiline/quoted credential values require manual handling rather than guessing.

Create/restrict the private directory before using it. The original combined
backup is retained there for recovery and must never be loaded by an application.
After intentional profile edits, do not rerun the splitter to overwrite them:
use `local:check` instead. Do not restore the combined backup into a running Next
website. Keep checkpoints under ignored `work/ops-01/`, outside release candidates.

## Verification boundary

Initial OPS-01 tested scoped configuration and safe loading, not end-to-end operational
publication. Current evidence and exact pass/fail/skip counts are in the ignored
`work/ops-01/checkpoint.md`. Unit tests use in-memory mocks and fresh temporary
storage. Neither their success nor successful API/worker compilation establishes
readiness of Redis, ClamAV, isolated ingest, production configuration or VPS.

For the subsequent real-service proof and resolved initial holds, use
OPS_LOCAL_READINESS.md; the original checkpoints retain their historical results.
