# OPS-09 — SJ / Ruwang / Control integration boundary

## Reconciliation — 7 October 2026 (Langkah 2)

The sections dated 17 September below are retained as historical findings, **not current open-bug assertions**. `tests/integration-boundaries.test.mjs` now tests corrected behavior instead of asserting known bugs as success. Re-run it against explicitly identified bank/Control source; old 21-pass results do not certify current code.

| Finding | Current implementation / regression |
|---|---|
| B01 | Bank `validateIngestAcknowledgment` rejects malformed/misbound receipts before transactional completion; `mediaReadiness` validates status and now upload-session IDs, PUT URL/header shape, expiry and capacity before IDs/bytes are used. New-session DTO does not echo source_media_id/checksum: no such binding is fabricated. |
| B02 | Exact aggregate-version updates; obsolete DUPLICATE can receipt its own event without publishing the newer aggregate. FE `labels.ts` uses `COMPLETED: Selesai`, because `changeRequest.service.js` may complete locally with no outbox. Completion still is not public evidence. |
| B03 | `outboxLease.js`: expired SENDING recovery, renewal, owner/attempt fencing and ordered SKIP LOCKED claim. Boundary tests execute real service/query code with doubles, not a database concurrency proof. |
| B04 | QUARANTINED/REVOKED/EXPIRED/REJECTED media maps to unavailable REJECTED, with conditional state/central-ID/revocation guards. |
| B05 | Explicit nonretryable errors are respected; bounded transient retries remain. |
| B06 | Strict reconciliation run/manifest/count/mismatch validation; malformed reports fail, not MATCHED/zero. |
| B07 | **Superseded** by user decision 5 October: Control public observation retired. Regression checks removal from DTO/UI/service and preservation of archived audit; do not restore the old probe. Bank/SJ visibility contracts remain separate. |
| B08 | Current Control cross-app tests call `tests/support/owned-sj-integration.mjs` and bank `scripts/run-sj-isolated-tests.js`, not the old shared-database harness. Ownership guard, actual service integration and browser E2E are separate proof classes. |

Local run logs, candidate hashes, executed coverage and limitations for Langkah 2 live outside release repositories in the task workspace `output/step2-contracts-20261007/`. This note does not claim production readiness, hosted CI, VPS verification or that a test-double pass is real E2E.

## Decision and scope

Audited 2026-09-17 against actual local source, not only old handoff documents.
**Boundary audit completed with downstream blockers; cross-application end-to-end readiness is NOT established.**
No application/UI/contract/migration changes were needed or made in SJ for this audit.
Only SJ tests and documentation were added. Ruwang backend, Ruwang frontend and Control were read-only.
No operational credentials, database mutation, live worker activation, deployment or VPS access was used.

The existing OPS-08 evidence is historical prerequisite evidence, not a new OPS-09 full-stack run.
Machine-specific source fingerprints, command logs and disconnect checkpoint live in ignored `work/ops-09/`.

## What each acknowledgment establishes

| Boundary | Evidence / meaning | Does NOT establish |
| --- | --- | --- |
| Control decision | Authorized operator, contributors, central authority, resource version/checksum; pending command | Bank has applied it |
| Bank application | Signed `RUWANG-CONTROL-V1` ACK, `APPLIED` or `REJECTED`; exact command digest, instance and resource | SJ has ingested an event |
| Bank outbox | Immutable event ID, creation timestamp, aggregate version, payload/checksum; fresh nonce on transport retry | Delivery or public visibility |
| SJ ingest | JSON ACK `APPLIED` or `DUPLICATE`, exact event ID and current `active_aggregate_version` | Projection, media delivery or public visibility; this is NOT a signed Control ACK |
| Projection | Search document version agrees with current publication | Current contact/profile/media/confirmation eligibility |
| Media | Scanner/derivatives complete, metadata `READY` | Permanent storage/network availability or eligibility after revoke |
| Public read | Current public eligibility and an actual public response at observation time | Future visibility, every search result or every media URL |
| Monitoring | Signed, scoped, timestamped aggregate health snapshot | Per-publication completion |

Never turn an HTTP success, a matching reconciliation cursor, or a bank `PUBLISHED` state into a new proof of public visibility.
An old event can return `DUPLICATE` with a newer active aggregate version. It must not revive its historical desired state locally.

## Event and identifier mapping

| SJ event | Aggregate type | Aggregate ID supplied by bank |
| --- | --- | --- |
| `UPSERT_BPRS_PROFILE` | `BPRS_PROFILE` | SJ institution ID, not bank profile-version ID |
| `HIDE_BPRS_PROFILE` | `BPRS_PROFILE` | Same institution ID |
| `UPSERT_WHATSAPP_CONTACT` | `WHATSAPP_CONTACT` | Bank contact ID, not contact-version ID |
| `REVOKE_WHATSAPP_CONTACT` | `WHATSAPP_CONTACT` | Same contact ID |
| `UPSERT_PUBLICATION_SNAPSHOT` | `PUBLICATION` | Bank source publication ID, not SJ internal publication row ID |
| `UNPUBLISH_PUBLICATION` | `PUBLICATION` | Same source publication ID |
| `ARCHIVE_PUBLICATION` | `PUBLICATION` | Same source publication ID; retained history, not hard delete |
| `REVOKE_MEDIA` | `MEDIA` | **Central** media ID, not bank source media ID |

Actual sender locations: backend `src/modules/seputar-jaminan/seputarJaminan.service.js` (`createOutbox`, `buildPublicationPayload`, publication lifecycle), `profileContact.service.js` (profile/contact lifecycle), `media.service.js`, `syncWorker.service.js` (`uploadMedia`, `deliverOutbox`). Receiver: SJ `apps/api/src/ingest-service.ts`, `media-service.ts` and contracts.

- Upload sends local `source_media_id`; SJ returns separate `media_id` and `upload_session_id`. Bank stores them separately. Publication media and profile `public_mark` use central IDs. Review snapshots intentionally retain both source and central media IDs.
- Control resource `expected_version`/`expected_checksum` refer to the reviewed bank snapshot or change-request impact. They are not interchangeable with SJ aggregate versions or publication source IDs.
- SJ payload checksum is canonical JSON SHA-256. HTTP content checksum covers the actual serialized request bytes. The full immutable event identity is checked separately by SJ. Do not hash a reserialized body in place of the transmitted body.
- Control transport uses its own prefixed signing message and base64url Ed25519 signature. Its command digest is canonical; signed ACK verification binds command ID/digest, instance and resource.
- Bank retries currently preserve the envelope timestamp and regenerate transport nonce/signature. SJ duplicate handling and higher active cursor semantics remain unchanged.
- All **18 files enumerated in the bank vendor manifest** match SJ contract bytes. This is not a claim that all consumer DTOs/OpenAPI consumers are current: response interpretation is the defect below. Vendor manifest verification itself also passes.

## Authority, removal and monitoring

Actual backend `controlReview.service.js` checks central configuration plus database authority/installation/review-enabled settings, command version/checksum, contributors, signature and ledger. `seputarJaminan.service.js:assertReviewAuthority` distinguishes local from central actors. Control `src/server/review-adapter.ts` checks enabled central instances and verifies the signed bank ACK. This audit exercised the actual ACK verifier with dependency doubles, not the database-backed authorization workflow.

`changeRequest.service.js` already supports `UNPUBLISH_PUBLICATION`, `ARCHIVE_PUBLICATION`, `RECONFIRM_PUBLICATION`, `HIDE_PROFILE`, `REVOKE_CONTACT`, and `REVOKE_MEDIA`. Approval rechecks request version, impact checksum and blockers before invoking domain lifecycle functions. Local media IDs are resolved to central IDs for the revoke event. Publication requests carry reference code without profile slug; profile requests carry profile slug without reference code.

Some Control `docs/handoff.md` / `docs/sj-v1-scope.md` statements that removal/reconfirm requests are absent are stale relative to actual source. Do not implement a second competing workflow from those statements.

Archive remains logical archival. There is no approved physical purge/retention contract here. Required future decisions: authority to request/approve purge, retention age, audit/legal retention, media/reference cleanup, replay/tombstone handling, backup retention, and rollback/recovery. Do not invent a hard-delete endpoint.

SJ monitoring route is `/v1/internal/ruwang-control/sj-monitoring/snapshot`. The actual SJ handler signs a minimal `sj_central` snapshot consumed successfully by actual Control `src/domain/monitoring-transport.ts`. Request replay and response tamper/wrong instance/staleness are rejected in memory. Worker heartbeat requires processing-capable, recent structured evidence rather than process liveness. Aggregate queue health is not an asset-specific proof. Real Control scheduler/nonce persistence/collector availability was not exercised here.

## Downstream blockers — do not patch across repositories in OPS-09

Paths below are relative to the named repository. The executable gap checks reproduce current behavior; their passing result means **the defect was reproduced**, not that it is acceptable.

| ID | Owner / exact source | Finding and required outcome |
| --- | --- | --- |
| B01 | Backend `src/modules/seputar-jaminan/syncWorker.service.js:signedRequest`, `deliverOutbox`, response-consuming media functions | Any successful JSON, `{}`, or malformed JSON converted to `{}` can be accepted. Empty ACK causes outbox ACK and request COMPLETED. Validate response contract, event identity, `APPLIED/DUPLICATE`, cursor and timestamp before transactional completion; validate upload/status/reconciliation identities too. Never mark success on malformed response. |
| B02 | Same `acknowledgeAggregate`, `deliverOutbox`; frontend `src/components/seputar-jaminan/SeputarJaminanUI.tsx:SjPublicStatusBadge`, `SeputarJaminanSubmissionsClient.tsx:CHANGE_STATE_LABEL` | Even a genuine `DUPLICATE` with active version 2 for event version 1 requests local `PUBLISHED`. Frontend derives `Tayang` from published-version + ACK and `Selesai di pusat` from COMPLETED. Separate ingest acknowledgment from observed projection/media/public state; unknown must remain unknown. Do not weaken SJ eligibility to satisfy these labels. |
| B03 | Backend `syncWorker.service.js:claimOutbox`, `deliverOutbox`, `failOutbox` | Claim query includes only QUEUED/RETRYING while claim writes SENDING; stale-lock predicate cannot reclaim SENDING. Completion uses row ID without lease-owner fence. Source/query evidence only in OPS-09, not a real crash/concurrency test. Need lease reclaim/renewal/conditional completion and isolated crash/two-worker proof. |
| B04 | Backend `syncWorker.service.js:uploadMedia` | PROCESSING status polling handles READY, REJECTED/REVOKED/EXPIRED, but silently keeps local PROCESSING for central QUARANTINED while returning processed=true. Define truthful mapping/retry rules; never falsely restore READY or loop as success. SJ `media-service.ts:status` really returns the current state, including quarantine. |
| B05 | Backend `syncWorker.service.js:signedRequest`, `failOutbox` | Uses HTTP code only for retryability. Actual SJ `INGEST_DISABLED` is 503 with `retryable:false`; bank retries it. Honor validated explicit error retryability while preserving safe handling for network/proxy/non-JSON failures and bounded attempts. |
| B06 | Backend `syncWorker.service.js:processReconciliation` | `{status:COMPLETED}` with no run ID/counts/mismatches becomes MATCHED with zero checked. Validate run ID, shape/counts, completeness and mismatch codes; retain failed/unknown on invalid report. A valid zero-mismatch database observation still is not network/media-delivery health. |
| B07 | Control `src/server/reviews.ts:publicVisibility` | Actual function returns `visible` for HTTP 200 even when body is non-JSON garbage. Validate expected public DTO/resource identity, classify observation failure as unknown, retain observed time and do not infer search/media or required version from a detail-only probe. HTTP 404 is an observation, not proof of causal execution of the requested action. |
| B08 | Control `tests/central-review-full-flow.test.mjs`; backend `src/integration/control-review-adapter.workflow.test.js` | Existing full-flow harness reads application env files and hardcodes old/shared local database names including `seputarjaminan_ci`. It is prohibited for this task. Need three fresh disposable, marked/role-verified DBs and marked storage before any real cross-app mutative test. Localhost alone is insufficient. |

B01/B02/B04/B05/B06/B07 have executable behavior reproductions. B03 has actual-query/source evidence. B08 is a read-only harness safety finding. Separate scoped implementation prompts are in `OPS09_DOWNSTREAM_PROMPTS.md`.

## Reproducible boundary tests

From SJ in PowerShell, after ensuring the two source roots are the intended read-only checkouts:

```powershell
$env:SJ_BOUNDARY_BANK_ROOT = 'D:/backend-production'
$env:SJ_BOUNDARY_CONTROL_ROOT = 'D:/ruwang-control'
node --import tsx --test tests/integration-boundaries.test.mjs
```

The suite requires explicit roots, verifies the vendor manifest, imports pure contracts, and executes actual bank worker / Control verifier source in memory with strict dependency substitutes. It never imports bank Prisma, dotenv, application storage or runtime bootstraps. Fetch is substituted; generated keys exist only in memory. Missing roots fail rather than silently skipping. It is intentionally separate from portable `test:unit`, since CI does not necessarily have the other repositories.

Coverage: eight event allowlists/checksums/versions, vendored file parity, actual bank signature and nonce renewal, both Control/bank command/ACK schemas, actual signed Control ACK verifier (identity/digest/time/signature negatives), SJ-versus-Control protocol separation, actual SJ-to-Control signed monitoring and replay/tamper rejection, and the marked gap reproductions.

Not covered by doubles: real bank transaction/authorization persistence, media bytes across all apps, queue race/crash recovery, actual polling/monitoring scheduler, browser labels in bank/Control, deployment routing, and full cross-app lifecycle. No localhost service URL was actually contacted in OPS-09. URLs in test doubles are not live test evidence. Production build is not repeated for test/documentation-only changes; runtime source fingerprints must remain equal to the baseline.

## Safe resume

Read `work/ops-09/checkpoint.md`, `baseline.json`, `quality.json`, `integrity.json` and logs. Do not recreate/overwrite the baseline. Check external source fingerprints before trusting prior compatibility results. If external files change, rerun the boundary tests against a new explicitly identified snapshot and convert resolved GAP assertions into positive regression checks in the owning repository. Never interpret a green GAP reproduction as a release gate.

OPS-09 stops at this repository boundary. No authority is granted here to execute the downstream prompts or proceed to the next operational stage.

## Final local verification (2026-09-17)

- Boundary suite: **21 passed, 0 failed, 0 skipped**. Breakdown: **13 compatibility checks and 8 known-gap evidence checks**, not 21 compatibility successes. B03 only captures the actual query; B08 is a source audit, not an executed test.
- Existing unit suite: **89 passed, 0 failed, 0 skipped** (contracts 8, API 43, worker 18, config 14, storage 6).
- Repository lint, TypeScript check, contract verification: **passed**. Contract verification reports 12 schemas / 27 OpenAPI paths.
- Runtime/source baseline: **335 scoped files unchanged** (SJ 199, backend 70, frontend 17, Control 49). Backend/frontend Git status also unchanged. Control is not a Git repository, so its evidence is the scoped file fingerprint, not a Git diff.
- New release-candidate files are only this document, `OPS09_DOWNSTREAM_PROMPTS.md` and `tests/integration-boundaries.test.mjs`. Existing user changes were not removed. Staged file list is empty. Local evidence/checkpoint is Git-ignored.
- Not run: real cross-application mutative suite (B08 blocks safe execution), cross-app browser/worker failure tests, production build, remote CI or deployment. These are **not** counted as passes. No local service was started/contacted; no live URL to report for this stage.
- Initial test-harness issues (VM CommonJS export binding, a test confirmation date not exactly 30 days, lint-reserved variable name) were corrected and the complete final gate rerun. No unresolved SJ test failure remains. The downstream blockers remain open.
