import type { Prisma } from "../../../generated/prisma/client.ts";
import type { ManifestItem } from "./reconciliation.js";

// Report current database eligibility independently of the delivery cursor.
// Read-only, tenant-bounded batches; no resending, state repair or unquarantine.
export async function actualStateMismatches(tx: Prisma.TransactionClient, institutionId: string, items: ManifestItem[]) {
  const ids = (type: string) => items.filter(i => i.aggregate_type === type).map(i => i.aggregate_id);
  const institution = await tx.institution.findUnique({ where: { id: institutionId }, select: { state: true } });
  const profiles = await tx.bprsProfile.findMany({ where: { institutionId, sourceProfileId: { in: ids("BPRS_PROFILE") } }, include: { publicMark: true } });
  const contacts = await tx.whatsappContact.findMany({ where: { institutionId, sourceContactId: { in: ids("WHATSAPP_CONTACT") } } });
  const publications = await tx.publication.findMany({ where: { institutionId, sourcePublicationId: { in: ids("PUBLICATION") } }, include: {
      profile: true, whatsappContact: true, searchDocument: true, media: { include: { mediaObject: true } },
    } });
  const media = await tx.mediaObject.findMany({ where: { institutionId, id: { in: ids("MEDIA") } } });
  const now = new Date();
  const ready = (m: { state: string; deliveryObjectKey: string | null; deliveryMime: string | null }) =>
    m.state === "READY" && m.deliveryObjectKey !== null && m.deliveryMime === "image/webp";
  return items.flatMap(item => {
    let code: string | undefined;
    const expected = item.expected_public_state;
    if (item.aggregate_type === "PUBLICATION") {
      const p = publications.find(p => p.sourcePublicationId === item.aggregate_id);
      if (!p) { if (!["UNPUBLISHED", "ARCHIVED"].includes(expected)) code = "ACTUAL_AGGREGATE_MISSING"; }
      else if (p.state !== expected) code = "ACTUAL_STATE_MISMATCH";
      else if (expected === "PUBLISHED") {
        if (institution?.state !== "ACTIVE" || p.profile.state !== "ACTIVE" || p.whatsappContact.state !== "VERIFIED"
          || p.availability !== "AVAILABLE" || p.nextReconfirmationAt <= now) code = "PUBLICATION_NOT_ELIGIBLE";
        else if (p.media.filter(m => m.isCover && ready(m.mediaObject)).length !== 1
          || p.media.some(m => !ready(m.mediaObject))) code = "MEDIA_NOT_READY";
        else if (p.searchDocument?.projectionVersion !== p.aggregateVersion) code = "PROJECTION_NOT_READY";
      }
    } else if (item.aggregate_type === "BPRS_PROFILE") {
      const p = profiles.find(p => p.sourceProfileId === item.aggregate_id);
      if (!p) { if (expected !== "HIDDEN") code = "ACTUAL_AGGREGATE_MISSING"; }
      else if (p.state !== expected) code = "ACTUAL_STATE_MISMATCH";
      else if (expected === "ACTIVE" && (institution?.state !== "ACTIVE" || !ready(p.publicMark))) code = "PROFILE_NOT_ELIGIBLE";
    } else if (item.aggregate_type === "WHATSAPP_CONTACT") {
      const c = contacts.find(c => c.sourceContactId === item.aggregate_id);
      if (!c) { if (expected !== "REVOKED") code = "ACTUAL_AGGREGATE_MISSING"; }
      else if (c.state !== expected) code = "ACTUAL_STATE_MISMATCH";
    } else if (item.aggregate_type === "MEDIA") {
      const m = media.find(m => m.id === item.aggregate_id);
      if (!m) { if (expected !== "REVOKED") code = "ACTUAL_AGGREGATE_MISSING"; }
      else if (m.state !== expected) code = "ACTUAL_STATE_MISMATCH";
      else if (expected === "READY" && !ready(m)) code = "MEDIA_NOT_READY";
    }
    return code ? [{ aggregate_id: item.aggregate_id, code, recommended_action: "CONTACT_OPERATIONS" }] : [];
  });
}
