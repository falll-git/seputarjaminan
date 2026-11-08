# Separate downstream tasks — NOT executed by OPS-09

> Historical prompts dated OPS09. See the 7 October reconciliation in `INTEGRATION_BOUNDARIES.md` before using them. Several sender/lease/guard changes now exist; the frontend COMPLETED label and upload-session validation are reconciled in Langkah 2. Prompt 3's Control public-observation feature was retired by the user on 5 October and must **not** be reintroduced. The old gap-reproduction tests have become corrected-behavior regressions; passing old bug expectations is not a gate.

Use these only in separately authorized tasks. Preserve approved visual design and existing worktrees; read each repository's AGENTS/dependency instructions first. Never load production/admin-bank credentials, mutate old workflow databases, commit/push/deploy, touch VPS, reset databases or edit historical migrations. Tests must fail before mutation unless disposable DB/storage identity, role scope and owner marker match. Archive is not hard delete.

## 1. Ruwang backend: sender correctness and recovery

Work only in `D:\backend-production`; SJ and Control are read-only contract sources. Read SJ `INTEGRATION_BOUNDARIES.md` and the current OpenAPI (not just vendor event schemas). Address B01–B06 in `src/modules/seputar-jaminan/syncWorker.service.js`, associated types/tests, and `changeRequest.service.js` only if completion semantics require it.

1. Validate typed responses for ingest, upload session/complete/status and reconciliation. Match sent event/run/media identity, enum, timestamp and required fields. Ingest accepts APPLIED/DUPLICATE, never arbitrary HTTP 2xx. A duplicate may report a higher active version; do not regress local desired state or claim public visibility. Preserve immutable event envelopes and new transport nonces on retry. Do not fabricate a signed Control ACK from SJ JSON.
2. Distinguish approved/applied bank business state, outbox delivery, SJ acknowledgment, media readiness and observed public visibility. Make COMPLETED terminology explicit for removal/reconfirm. Unknown observations stay unknown. If DTO work is necessary, document the minimal frontend dependency rather than silently changing semantics.
3. Respect validated explicit `retryable` errors, including non-retryable INGEST_DISABLED 503, with safe bounded fallback for network/timeout/proxy/non-JSON responses. Reject incomplete reconciliation rather than defaulting it to MATCHED. Never bypass signature/nonce/checksum/tenant checks.
4. Handle QUARANTINED and every actual SJ media status honestly. Do not convert quarantine to READY or report a perpetually pending media as successfully finalized.
5. Implement explicit reclaim/lease ownership/renewal/conditional completion for stranded SENDING and stale workers. Prove crash after claim, crash after remote ACK before local commit, lease expiry, two workers and stale completion. Preserve per-aggregate ordering and define handling for terminally failed predecessors without silently dropping lifecycle events.
6. Use generated in-memory Ed25519 keys and contract doubles first. For mutative tests create verified disposable bank DB/storage, never existing local business DB. Reproduce all OPS09 gap cases as failing expectations for the old behavior, then prove corrected expectations. Report pass/fail/skip and rollback/checkpoint. Do not edit SJ/Control/frontend from this task.

## 2. Ruwang frontend: labels based on proven state

Work only in `D:\frontend-production`, after backend DTO/semantics are agreed. Read-only reference: backend contracts and SJ `INTEGRATION_BOUNDARIES.md` B02.

Inspect `src/components/seputar-jaminan/SeputarJaminanUI.tsx:SjPublicStatusBadge`, `SeputarJaminanSubmissionsClient.tsx:CHANGE_STATE_LABEL`, `SeputarJaminanDashboardClient.tsx`, and `src/types/seputar-jaminan.types.ts`. Do not infer Tayang/Versi lama tayang merely from ACKNOWLEDGED plus a published version, or final externally observed removal from COMPLETED without its documented meaning. Display separate truthful delivery/observation labels and unknown/stale states. Preserve existing layout/visuals. Test ACK-but-projection-pending, media quarantine, hidden profile, revoked contact, expired confirmation, newer central version, failed observation and final removal. No new public/admin endpoint, database writes, or fake fallback data. Stop if required backend DTO is missing.

## 3. Control: visibility observation and accurate handoff

Work only in `D:\ruwang-control`. Reference SJ and bank source read-only. Address B07 in `src/server/reviews.ts:publicVisibility` and relevant tests/types/UI without redesign.

Treat signed bank APPLIED ACK as bank execution only. Validate public response content type, body shape and expected resource identity; HTTP 200 alone is insufficient. Record observation scope/time and keep unknown on malformed/wrong resource/network failure. Do not claim a specific publication version, search projection, every media response, or removal causality unless separately observed. Preserve strict signed ACK verification in `src/server/review-adapter.ts` and signed monitoring in `src/domain/monitoring-transport.ts`, including replay protection. Cover 200 garbage/wrong ID, 404, 503, timeout, stale observation, pending command and all removal/reconfirm targets.

Update `docs/handoff.md`, `docs/sj-v1-scope.md` and any derived handoff that still says change_request/removal/reconfirm is absent: source already implements it. Document the remaining bank sender/visibility/test-environment dependencies, not an E2E success claim. Hard delete remains a separate retention/authority decision. No SJ or bank repository edits.

## 4. Cross-app test harness isolation and final verification

Separately authorize the owning repository for each harness change. Start with Control `tests/central-review-full-flow.test.mjs` (B08); bank `src/integration/control-review-adapter.workflow.test.js` requires a separate bank-scoped edit if needed.

Remove dependence on runtime `.env` files and hardcoded `ruwang_arsip_local`, `ruwang_control`, `seputarjaminan_ci` as disposable targets. Require explicit private test configuration for three **new** databases and persistent test-only storage roots. Verify loopback/container identity, exact DB name, scoped role, disposable owner marker, storage sentinel and forbidden old-target denylist BEFORE migrations/seeds/cleanup. Migration owner and runtime roles are separate. Never reuse an old workflow database or rely only on a localhost/name-regex check. Capture old-target read-only fingerprints before/after if authorized. Cleanup must be fixture-scoped and marker-guarded.

Only after backend/Control/frontend fixes and isolated targets are ready, run real existing paths: signed Control decision → bank apply/signed ACK → bank outbox → SJ upload/real scanner/media READY → profile/contact/publication → projection → public search/detail/media/WhatsApp URL → authorized withdrawal. Use two institutions and negative access cases. No SQL status shortcuts, operational credentials, or actual WhatsApp sending. Verify retry/restart, malformed ACK, stale version, hidden/suspended/quarantined/revoked/expired, direct media access, metadata allowlists, log redaction and source fingerprints. Distinguish proof of each boundary; preserve failures/skips separately. Do not mark end-to-end complete until all required actual application paths pass.
