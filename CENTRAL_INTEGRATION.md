# Central integration verification (OPS-08)

## Safety and execution

The tests must not use the application's operational environment. In particular,
the existing local `seputarjaminan_ci` database is **not disposable**.

The integration suites require six explicit `SJ_TEST_*_DATABASE_URL` values
(OWNER, REGISTRY, INGEST, PUBLIC, OPS, WORKER), six distinct logins, the same
database endpoint, `SJ_CI_ALLOW_DISPOSABLE_DATABASE=true`, and a matching
`SJ_TEST_DISPOSABLE_MARKER` database comment. A boolean or a database name alone
is insufficient. Redirecting connection query parameters are rejected.

- Local OPS-08: the freshly created, externally marked `sj_ops08_20260917`
  target on loopback port 55482, with an `OPS08:<UUID>` ownership marker.
  The local real-service helper additionally verifies the Docker cluster ID,
  label/volume/port bindings and the external storage ownership marker.
- GitHub Actions: the isolated `postgres` service, database `seputarjaminan_ci`,
  and `CI:<run_id>:<run_attempt>` marker. Provisioning requires an empty database
  and refuses localhost. This is not authorization to run against a VPS.

`SJ_TEST_REDIS_URL` is explicit; tests never fall back to runtime `SJ_REDIS_URL`.
Fixed fixture IDs must be absent before setup. Cleanup deletes only the fixtures
owned by that test, never a reset/truncate or an unrelated installation.

Use `npm run test:integration` only with the verified test environment. Missing
environment skips infrastructure suites and is **not** integration evidence.
The standard publication suite uses real Redis/ClamAV when the verified local
target file is supplied; its scanner-isolated CI variant uses TEST_SAFE and must
be reported separately from the real scanner evidence.

## Real-service scenario

`apps/api/tests/integration/central-services.mjs` exports
`verifyCentralServices`. The local orchestrator supplies a verified owner client,
scoped runtime URLs, free loopback API/website ports, and callbacks for evidence,
normal Next HTML verification and retention of fixture ownership. It requires
the verified local services, refuses TEST_SAFE, and runs:

- Two institution signers, two actual contacts, real logo upload and scanner.
- Eight publication snapshots: land, building, machine and vehicle for each
  institution; partial attributes, zero mileage, portrait/landscape and gallery.
- Real upload processing, derivatives, public search, deterministic pagination,
  taxonomy-backed filters, profiles and publication-specific WhatsApp URLs.
- Exact public response field allowlists, private sentinels in internal identity,
  credential/payload exclusion from API responses, HTML, errors and HTTP logs.
- Cross-tenant media/session/contact/profile denial, private endpoint denial,
  no original media delivery, and API/proxy no-store behavior after withdrawal.
- Hidden/suspended/quarantined/revoked/expired conditions and archive retention.

Positive business transitions use the signed API and actual worker. Ops control
transitions use the real ops service with a non-login test audit principal;
the separate ops-auth suite verifies MFA/session/CSRF authorization. SQL is used
for that bootstrap principal, read-only assertions and strictly scoped fixture
cleanup, never to fake READY, PUBLISHED or other business success.

No WhatsApp messages are sent. The URL destination and decoded message are
asserted locally. No browser or API points at preview sample data.

## HTTP log privacy

HTTP serializers allow only request id/method and response status; arbitrary
headers, query strings, bodies and exception messages/stacks are excluded.
Error responses keep their documented public envelope and request correlation.
Malformed JSON returns a non-retryable 400 `JSON_INVALID`, not a 500 server error;
raw parser messages and submitted data are never returned or logged.
Regression tests include synthetic authorization, CSRF, query and body canaries.

## Evidence boundaries

Machine-specific targets, credentials, reports, logs and restart checkpoints stay
outside the release candidate (private external configuration and ignored
`work/ops-08/`). They are not embedded in normal application configuration.
Retained central-suite data is isolated test evidence, not public sample content.
Only owned test listeners are stopped after the run.

This verifies local central integration, not VPS deployment, S3 behavior, remote
GitHub execution, or Ruwang/Control end-to-end authority and ACK handling. Those
remain separately gated. Approved frontend source must remain byte-identical.
