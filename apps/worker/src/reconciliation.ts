export type ManifestItem = {
  aggregate_type: string;
  aggregate_id: string;
  aggregate_version: number;
  expected_public_state: string;
  payload_checksum: string;
};

export function compareManifest(
  items: ManifestItem[],
  cursors: Array<{
    aggregateId: string;
    aggregateVersion: number;
    expectedState: string;
    payloadChecksum: string;
  }>,
) {
  const byId = new Map(cursors.map((cursor) => [cursor.aggregateId, cursor]));
  return items.flatMap((item) => {
    const central = byId.get(item.aggregate_id);
    if (!central) {
      return [{
        aggregate_id: item.aggregate_id,
        code: "MISSING_CENTRAL_AGGREGATE",
        recommended_action: "RESEND_SNAPSHOT",
      }];
    }
    if (central.aggregateVersion !== item.aggregate_version) {
      return [{
        aggregate_id: item.aggregate_id,
        code: "AGGREGATE_VERSION_MISMATCH",
        recommended_action:
          central.aggregateVersion < item.aggregate_version ? "RESEND_SNAPSHOT" : "CONTACT_OPERATIONS",
      }];
    }
    if (central.expectedState !== item.expected_public_state) {
      return [{
        aggregate_id: item.aggregate_id,
        code: "PUBLIC_STATE_MISMATCH",
        recommended_action:
          item.expected_public_state === "UNPUBLISHED" ? "SEND_UNPUBLISH" : "RESEND_SNAPSHOT",
      }];
    }
    if (central.payloadChecksum !== item.payload_checksum) {
      return [{
        aggregate_id: item.aggregate_id,
        code: "PAYLOAD_CHECKSUM_MISMATCH",
        recommended_action: "RESEND_SNAPSHOT",
      }];
    }
    return [];
  });
}
