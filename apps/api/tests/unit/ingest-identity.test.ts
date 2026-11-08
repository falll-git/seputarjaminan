import assert from "node:assert/strict";
import test from "node:test";
import { payloadChecksum } from "@seputarjaminan/contracts";
import { IngestService } from "../../src/ingest-service.js";

const event = {
  event_id: "00000000-0000-4000-8000-000000000001", schema_version: 1 as const,
  event_type: "UPSERT_BPRS_PROFILE", institution_id: "00000000-0000-4000-8000-000000000002",
  aggregate_id: "00000000-0000-4000-8000-000000000002", aggregate_version: 1,
  occurred_at: "2026-09-17T00:00:00.000Z", payload_checksum: payloadChecksum({ value: "original" }), payload: { value: "original" },
};
const auth = { institutionId: event.institution_id, installationId: event.institution_id, keyId: event.event_id, nonceHash: "a".repeat(64), requestTimestamp: new Date() };
function setup(legacy = false) {
  let writes = 0;
  const row = { institutionId: event.institution_id, eventType: event.event_type, aggregateId: event.aggregate_id,
    aggregateVersion: 1, schemaVersion: 1, state: "APPLIED", payloadChecksum: event.payload_checksum,
    identityChecksum: legacy ? null : payloadChecksum(event) };
  const tx = { $executeRaw: async () => 1, ingestEvent: { findUnique: async () => row, create: async () => { writes++; } },
    aggregateCursor: { findUnique: async () => ({ aggregateVersion: 3 }) } };
  const service = new IngestService({ ingest: { $transaction: async (f: any) => f(tx) } } as any);
  return { service, writes: () => writes };
}
test("duplicate immutable event returns current cursor without applying business writes", async () => {
  const { service, writes } = setup();
  assert.deepEqual(await service.ingest(event, auth), { status: "DUPLICATE", activeAggregateVersion: 3 });
  assert.equal(writes(), 0);
});
test("same event ID rejects changed metadata even when payload checksum matches", async () => {
  for (const changed of [{ event_type: "HIDE_BPRS_PROFILE" }, { aggregate_id: event.event_id },
    { aggregate_version: 2 }, { occurred_at: "2026-09-18T00:00:00.000Z" }, { payload_checksum: "b".repeat(64) }]) {
    const { service, writes } = setup();
    await assert.rejects(service.ingest({ ...event, ...changed }, auth), (e: any) => e.code === "EVENT_ID_CONFLICT");
    assert.equal(writes(), 0);
  }
});
test("legacy identity is explicit: retained metadata checked, unknown occurred_at not invented", async () => {
  const { service } = setup(true);
  assert.equal((await service.ingest(event, auth)).status, "DUPLICATE");
  await assert.rejects(service.ingest({ ...event, aggregate_version: 2 }, auth), (e: any) => e.code === "EVENT_ID_CONFLICT");
});
