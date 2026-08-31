import assert from "node:assert/strict";
import test from "node:test";
import { compareManifest } from "../../src/reconciliation.js";

test("reconciliation hanya menghasilkan tindakan aman dan tidak mengubah data", () => {
  const items = [
    { aggregate_type: "PUBLICATION", aggregate_id: "a", aggregate_version: 2, expected_public_state: "PUBLISHED", payload_checksum: "a".repeat(64) },
    { aggregate_type: "PUBLICATION", aggregate_id: "b", aggregate_version: 1, expected_public_state: "UNPUBLISHED", payload_checksum: "b".repeat(64) },
  ];
  const result = compareManifest(items, [
    { aggregateId: "a", aggregateVersion: 1, expectedState: "PUBLISHED", payloadChecksum: "a".repeat(64) },
  ]);
  assert.deepEqual(result, [
    { aggregate_id: "a", code: "AGGREGATE_VERSION_MISMATCH", recommended_action: "RESEND_SNAPSHOT" },
    { aggregate_id: "b", code: "MISSING_CENTRAL_AGGREGATE", recommended_action: "RESEND_SNAPSHOT" },
  ]);
});
