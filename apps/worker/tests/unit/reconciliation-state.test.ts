import assert from "node:assert/strict";
import test from "node:test";
import { actualStateMismatches } from "../../src/reconciliation-state.js";
import { compareManifest } from "../../src/reconciliation.js";

const item = { aggregate_type: "PUBLICATION", aggregate_id: "source-id", aggregate_version: 2, expected_public_state: "PUBLISHED", payload_checksum: "a".repeat(64) };
function transaction(change: any = {}) {
  const media = { state: "READY", deliveryObjectKey: "safe/main", deliveryMime: "image/webp" };
  const publication = { sourcePublicationId: "source-id", state: "PUBLISHED", aggregateVersion: 2, availability: "AVAILABLE",
    profile: { state: "ACTIVE" }, whatsappContact: { state: "VERIFIED" }, nextReconfirmationAt: new Date(Date.now() + 60_000),
    searchDocument: { projectionVersion: 2 }, media: [{ isCover: true, mediaObject: media }], ...change };
  return { institution: { findUnique: async () => ({ state: "ACTIVE" }) }, bprsProfile: { findMany: async () => [] },
    whatsappContact: { findMany: async () => [] }, publication: { findMany: async () => [publication] }, mediaObject: { findMany: async () => [] } } as any;
}
test("matching cursor never substitutes for actual publication eligibility", async () => {
  const cases = [
    [{ state: "QUARANTINED" }, "ACTUAL_STATE_MISMATCH"],
    [{ state: "UNPUBLISHED" }, "ACTUAL_STATE_MISMATCH"],
    [{ profile: { state: "HIDDEN" } }, "PUBLICATION_NOT_ELIGIBLE"],
    [{ whatsappContact: { state: "REVOKED" } }, "PUBLICATION_NOT_ELIGIBLE"],
    [{ nextReconfirmationAt: new Date(0) }, "PUBLICATION_NOT_ELIGIBLE"],
    [{ availability: "UNAVAILABLE" }, "PUBLICATION_NOT_ELIGIBLE"],
    [{ media: [] }, "MEDIA_NOT_READY"],
    [{ searchDocument: null }, "PROJECTION_NOT_READY"],
    [{ searchDocument: { projectionVersion: 1 } }, "PROJECTION_NOT_READY"],
  ];
  for (const [change, code] of cases) {
    const result = await actualStateMismatches(transaction(change), "tenant", [item]);
    assert.equal(result[0]?.code, code);
    assert.deepEqual(Object.keys(result[0]).sort(), ["aggregate_id", "code", "recommended_action"]);
  }
  assert.deepEqual(await actualStateMismatches(transaction(), "tenant", [item]), []);
});
test("aggregate type mismatch cannot pass matching ID/version/checksum", () => {
  const result = compareManifest([item], [{ aggregateId: item.aggregate_id, aggregateType: "MEDIA", aggregateVersion: 2,
    expectedState: "PUBLISHED", payloadChecksum: item.payload_checksum }]);
  assert.equal(result[0].code, "AGGREGATE_TYPE_MISMATCH");
});
