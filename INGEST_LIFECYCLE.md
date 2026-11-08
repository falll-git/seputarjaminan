# Ingest and lifecycle — OPS-07

Scope: local SJ API/worker/contracts. Approved website visuals are unchanged. No changes in Ruwang or Control, no deployment or production database mutation.

## The eight V1 events

| Event | Aggregate type / ID | Committed desired state |
| --- | --- | --- |
| UPSERT_BPRS_PROFILE | BPRS_PROFILE / institution_id | ACTIVE; quarantine remains authoritative |
| HIDE_BPRS_PROFILE | BPRS_PROFILE / institution_id | HIDDEN |
| UPSERT_WHATSAPP_CONTACT | WHATSAPP_CONTACT / whatsapp_contact_id | VERIFIED |
| REVOKE_WHATSAPP_CONTACT | WHATSAPP_CONTACT / whatsapp_contact_id | REVOKED; affected publications are unpublished |
| UPSERT_PUBLICATION_SNAPSHOT | PUBLICATION / source publication_id | PUBLISHED after existing profile/contact/media prerequisites |
| UNPUBLISH_PUBLICATION | PUBLICATION / source publication_id | UNPUBLISHED |
| ARCHIVE_PUBLICATION | PUBLICATION / source publication_id | ARCHIVED, retained row and history |
| REVOKE_MEDIA | MEDIA / central media_id | REVOKED; affected cover publications are unpublished |

Aggregate IDs cannot change type within one institution. Publication source IDs are not the internally generated publication row IDs. Versions must be strictly greater than the cursor for a new event. Gaps remain permitted by the existing snapshot contract; no sequential-only rule has been invented. A delayed lower version is rejected even when a hide/archive/revoke tombstone arrived before the object existed. A higher authorized snapshot can reactivate according to existing rules; retries of old events cannot do so.

## Identity, transactions and acknowledgment

- Ed25519, raw-body SHA-256, timestamp tolerance, key/installation/institution eligibility, nonce ledger and payload semantic validation are unchanged.
- Retries preserve the complete event envelope and use a fresh transport timestamp/nonce/signature. Replaying a nonce is rejected, including after a business validation failure.
- New events retain a canonical full-envelope SHA-256. Reusing an event ID with different metadata or payload is a conflict. Identical duplicates have no business effects.
- Historical events did not store occurred_at. The additive nullable identity checksum does not fabricate this information: legacy duplicates compare all retained identity fields, but cannot prove the original occurred_at. This compatibility limitation must not be advertised as full historical-envelope verification.
- Ingest business data, event ledger, aggregate cursor and projection enqueue commit in one serializable transaction. Serialization/unique races receive at most four attempts; exhaustion returns an explicit retryable 503 or non-retryable 409, not a fabricated success. No filesystem or transport side effects are repeated inside this retry loop.
- `APPLIED` means the ingest transaction committed. `DUPLICATE` means that event was previously applied, not that its desired state remains current. `active_aggregate_version` is the current cursor version observed when acknowledging, which may exceed a duplicate's version.

These are separate facts:

1. Control command ACK: bank applied the authorized business decision.
2. SJ ingest ACK: SJ committed the event transaction.
3. Projection readiness: search document version matches the publication version.
4. Media readiness: processing/scanner and derivative metadata completed; delivery/storage remains a separate dependency.
5. Public eligibility: current institution/profile/contact, availability, confirmation deadline and cover permit access. Actual HTTP delivery is checked separately; no database status promises future network/storage health.

## Reconciliation and safety transitions

Reconciliation compares aggregate type, version, desired state and checksum, then reads actual lifecycle, publication eligibility, media metadata and projection version. A matching cursor alone cannot yield a healthy comparison for a quarantined, expired or otherwise ineligible publication. Reads share a repeatable-read transaction. One diagnostic mismatch per manifest item retains the existing response shape; codes do not authorize automatic repair.

Negative tombstones without a materialized object can match, since there is no public object to hide/revoke. A missing expected-positive object is a mismatch. A zero-mismatch result is a database observation, not a claim that storage, proxy, network or every external consumer is healthy.

Quarantine always overrides incoming desired state. Operations locks the subject before inspecting/restoring quarantine intent. Resolution re-reads the quarantine record after acquiring the lock; a concurrent unpublish/hide/revoke cannot be undone by an earlier preflight read. Ingest does not clear quarantine. Contact re-verification does not automatically republish publications withdrawn by revocation. Expired confirmation is excluded by public reads before maintenance runs.

Archive is not hard delete. No purge policy, retention duration, removal of audit history, or deletion endpoint has been invented. Physical deletion requires an explicitly approved contract/retention policy outside this stage.

## Read-only dependency audit: Ruwang and Control

Source checked rather than relying on old Control handoff text:

- Ruwang `src/modules/seputar-jaminan/syncWorker.service.js` builds immutable events from outbox timestamps, renews transport nonces and serializes earlier aggregate deliveries. It currently marks publication PUBLISHED / sync ACKNOWLEDGED and change requests COMPLETED after successful ingest HTTP. These states are not independent proof of search/media/public readiness. Downstream interpretation and response identity/status validation need a separately authorized Ruwang task; no bank repository was changed here.
- Ruwang `changeRequest.service.js` already implements central-authority removal/reconfirm requests, impact/version checks and lifecycle execution. Old Control docs saying these features are entirely missing are stale. Completion at ingest ACK still needs separation from observed final visibility where the product requires that proof.
- Control `contracts/review-command.schema.json` supports publication/profile/contact/change_request and approve/request_revision/reject. `src/server/review-adapter.ts` enforces central authority and signed bank acknowledgment. Bank command ACK must not be relabeled SJ public visibility.
- Updated generated SJ OpenAPI types are local to SJ. Vendor/generated consumers in other repos require their own authorized synchronization; no cross-repo edits or activation took place.

## Migration and test operation

Two additive migrations follow the unchanged historical 15: `20260917160000_ingest_event_identity`, `20260917161000_reconciliation_read_scope`. The second grants worker SELECT on institutions/profiles/contacts, not write, registry secrets, ownership or BYPASSRLS. Migration owner remains separate from runtime. Apply migrations before starting the new API/worker against any future authorized target; older local databases were deliberately not upgraded.

Evidence and disconnect checkpoints are ignored under `work/ops-07/`, not release content. The private target manifest and marked storage are outside the repository. Integration tests use fresh signed workflows, actual scoped roles, PostgreSQL, Redis and ClamAV on the isolated OPS07 target; only the audit principal is a no-login test fixture. No SQL status edits, normal-runtime demo fallback or WhatsApp messages are used.

Run durable unit regressions with `npm run test:unit`; contract check with `npm run contracts:verify`; schema integrity with `npm run ci:migrations:check`. The local integration harness and guarded resume commands are recorded in the ignored final report, since their target identity is machine-specific.
