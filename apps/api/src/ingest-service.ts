import type { Prisma } from "../../../generated/prisma/client.ts";
import type { DatabaseClients, TransactionClient } from "./database.js";
import { withInstitution } from "./database.js";
import { ApiError } from "./errors.js";

type IntegrationEvent = {
  event_id: string;
  schema_version: 1;
  event_type: string;
  institution_id: string;
  aggregate_id: string;
  aggregate_version: number;
  occurred_at: string;
  payload_checksum: string;
  payload: Record<string, unknown>;
};

function aggregateType(eventType: string) {
  if (eventType === "UPSERT_BPRS_PROFILE") return "BPRS_PROFILE";
  if (eventType.includes("WHATSAPP_CONTACT")) return "WHATSAPP_CONTACT";
  if (eventType === "REVOKE_MEDIA") return "MEDIA";
  return "PUBLICATION";
}

function expectedState(eventType: string) {
  const states: Record<string, string> = {
    UPSERT_BPRS_PROFILE: "ACTIVE",
    UPSERT_WHATSAPP_CONTACT: "VERIFIED",
    REVOKE_WHATSAPP_CONTACT: "REVOKED",
    UPSERT_PUBLICATION_SNAPSHOT: "PUBLISHED",
    UNPUBLISH_PUBLICATION: "UNPUBLISHED",
    ARCHIVE_PUBLICATION: "ARCHIVED",
    REVOKE_MEDIA: "REVOKED",
  };
  return states[eventType];
}

function asJson(value: unknown) {
  return value as Prisma.InputJsonValue;
}

async function rememberDesiredStateDuringQuarantine(
  transaction: TransactionClient,
  institutionId: string,
  subjectType: "PROFILE" | "PUBLICATION" | "MEDIA",
  subjectId: string,
  desiredState: string,
) {
  await transaction.quarantineRecord.updateMany({
    where: { institutionId, subjectType, subjectId, state: "ACTIVE" },
    data: { previousState: desiredState },
  });
}

async function applyProfile(transaction: TransactionClient, event: IntegrationEvent) {
  const payload = event.payload as any;
  const existingProfile = await transaction.bprsProfile.findUnique({
    where: { institutionId: event.institution_id },
  });
  const mark = await transaction.mediaObject.findFirst({
    where: {
      id: payload.public_mark,
      institutionId: event.institution_id,
      state: "READY",
      purpose: "BPRS_PUBLIC_MARK",
      sourcePublicationId: null,
    },
  });
  if (!mark) {
    throw new ApiError(409, "PROFILE_MARK_NOT_READY", "Logo publik BPRS belum siap digunakan.");
  }
  await transaction.bprsProfile.upsert({
    where: { institutionId: event.institution_id },
    create: {
      institutionId: event.institution_id,
      sourceProfileId: event.aggregate_id,
      sourceVersion: event.aggregate_version,
      publicName: payload.public_name,
      publicMarkMediaId: payload.public_mark,
      shortDescription: payload.short_description,
      officeCityRegency: payload.office_city_regency,
      officeProvince: payload.office_province,
      profileUpdatedAt: new Date(payload.profile_updated_at),
      payloadChecksum: event.payload_checksum,
      state: "ACTIVE",
    },
    update: {
      sourceVersion: event.aggregate_version,
      publicName: payload.public_name,
      publicMarkMediaId: payload.public_mark,
      shortDescription: payload.short_description,
      officeCityRegency: payload.office_city_regency,
      officeProvince: payload.office_province,
      profileUpdatedAt: new Date(payload.profile_updated_at),
      payloadChecksum: event.payload_checksum,
      state: existingProfile?.state === "QUARANTINED" ? "QUARANTINED" : "ACTIVE",
    },
  });
  if (existingProfile?.state === "QUARANTINED") {
    await rememberDesiredStateDuringQuarantine(
      transaction,
      event.institution_id,
      "PROFILE",
      existingProfile.id,
      "ACTIVE",
    );
  }
}

async function applyContact(transaction: TransactionClient, event: IntegrationEvent) {
  const payload = event.payload as any;
  await transaction.whatsappContact.upsert({
    where: {
      institutionId_sourceContactId: {
        institutionId: event.institution_id,
        sourceContactId: payload.whatsapp_contact_id,
      },
    },
    create: {
      institutionId: event.institution_id,
      sourceContactId: payload.whatsapp_contact_id,
      sourceVersion: event.aggregate_version,
      phoneE164: payload.phone_e164,
      messageTemplateVersion: payload.template_version,
      state: "VERIFIED",
      verifiedAt: new Date(payload.verified_at),
      payloadChecksum: event.payload_checksum,
    },
    update: {
      sourceVersion: event.aggregate_version,
      phoneE164: payload.phone_e164,
      messageTemplateVersion: payload.template_version,
      state: "VERIFIED",
      verifiedAt: new Date(payload.verified_at),
      revokedAt: null,
      payloadChecksum: event.payload_checksum,
    },
  });
}

async function revokeContact(transaction: TransactionClient, event: IntegrationEvent) {
  const payload = event.payload as any;
  const contact = await transaction.whatsappContact.findUnique({
    where: {
      institutionId_sourceContactId: {
        institutionId: event.institution_id,
        sourceContactId: payload.whatsapp_contact_id,
      },
    },
  });
  if (!contact) return;
  await transaction.whatsappContact.update({
    where: { id: contact.id },
    data: {
      sourceVersion: event.aggregate_version,
      state: "REVOKED",
      revokedAt: new Date(payload.revoked_at),
      payloadChecksum: event.payload_checksum,
    },
  });
  const affectedPublications = await transaction.publication.findMany({
    where: {
      institutionId: event.institution_id,
      whatsappContactId: contact.id,
      state: { in: ["PUBLISHED", "QUARANTINED"] },
    },
    select: { id: true, state: true },
  });
  await transaction.publication.updateMany({
    where: { institutionId: event.institution_id, whatsappContactId: contact.id, state: "PUBLISHED" },
    data: { state: "UNPUBLISHED", unpublishedAt: new Date(payload.revoked_at) },
  });
  for (const publication of affectedPublications) {
    if (publication.state === "QUARANTINED") {
      await transaction.publication.update({
        where: { id: publication.id },
        data: { unpublishedAt: new Date(payload.revoked_at) },
      });
      await rememberDesiredStateDuringQuarantine(
        transaction,
        event.institution_id,
        "PUBLICATION",
        publication.id,
        "UNPUBLISHED",
      );
    }
  }
}

async function replaceCategoryDetail(
  transaction: TransactionClient,
  publicationId: string,
  institutionId: string,
  category: string,
  attributes: any,
) {
  await transaction.landDetail.deleteMany({ where: { publicationId } });
  await transaction.buildingDetail.deleteMany({ where: { publicationId } });
  await transaction.machineDetail.deleteMany({ where: { publicationId } });
  await transaction.vehicleDetail.deleteMany({ where: { publicationId } });
  if (category === "TANAH") {
    await transaction.landDetail.create({ data: {
      publicationId,
      institutionId,
      landAreaM2: attributes.land_area_m2,
      contour: attributes.contour,
      roadAccess: attributes.road_access,
    } });
  } else if (category === "BANGUNAN") {
    await transaction.buildingDetail.create({ data: {
      publicationId,
      institutionId,
      landAreaM2: attributes.land_area_m2,
      buildingAreaM2: attributes.building_area_m2,
      floorCount: attributes.floor_count,
      publicUsage: attributes.public_usage,
    } });
  } else if (category === "MESIN_PERALATAN") {
    await transaction.machineDetail.create({ data: {
      publicationId,
      institutionId,
      brandOrManufacturer: attributes.brand_or_manufacturer,
      modelOrType: attributes.model_or_type,
      manufactureYear: attributes.manufacture_year,
      publicCapacity: attributes.public_capacity,
      publicCondition: attributes.public_condition,
    } });
  } else {
    await transaction.vehicleDetail.create({ data: {
      publicationId,
      institutionId,
      brand: attributes.brand,
      modelOrType: attributes.model_or_type,
      manufactureYear: attributes.manufacture_year,
      transmission: attributes.transmission,
      fuelType: attributes.fuel_type,
      mileageKm: attributes.mileage_km,
      publicCondition: attributes.public_condition,
    } });
  }
}

async function applyPublication(transaction: TransactionClient, event: IntegrationEvent) {
  const payload = event.payload as any;
  const existingPublication = await transaction.publication.findUnique({
    where: {
      institutionId_sourcePublicationId: {
        institutionId: event.institution_id,
        sourcePublicationId: payload.publication_id,
      },
    },
  });
  const profile = await transaction.bprsProfile.findUnique({
    where: { institutionId: event.institution_id },
  });
  const contact = await transaction.whatsappContact.findUnique({
    where: {
      institutionId_sourceContactId: {
        institutionId: event.institution_id,
        sourceContactId: payload.whatsapp_contact_id,
      },
    },
  });
  if (!profile || profile.state !== "ACTIVE") {
    throw new ApiError(409, "BPRS_PROFILE_NOT_READY", "Profil publik BPRS belum siap digunakan.");
  }
  if (!contact || contact.state !== "VERIFIED") {
    throw new ApiError(409, "WHATSAPP_CONTACT_NOT_READY", "Kontak WhatsApp belum siap digunakan.");
  }
  const mediaIds = payload.media.map((item: any) => item.media_id);
  const media = await transaction.mediaObject.findMany({
    where: {
      institutionId: event.institution_id,
      id: { in: mediaIds },
      state: "READY",
      purpose: "PUBLICATION_IMAGE",
      sourcePublicationId: payload.publication_id,
    },
  });
  if (media.length !== new Set(mediaIds).size) {
    throw new ApiError(409, "PUBLICATION_MEDIA_NOT_READY", "Masih ada gambar katalog yang belum siap.");
  }
  const checksumById = new Map(media.map((item) => [item.id, item.sha256]));
  if (payload.media.some((item: any) => checksumById.get(item.media_id) !== item.checksum)) {
    throw new ApiError(409, "PUBLICATION_MEDIA_CHECKSUM_MISMATCH", "Checksum gambar katalog tidak sesuai media yang telah divalidasi.");
  }

  const publication = await transaction.publication.upsert({
    where: {
      institutionId_sourcePublicationId: {
        institutionId: event.institution_id,
        sourcePublicationId: payload.publication_id,
      },
    },
    create: {
      institutionId: event.institution_id,
      sourcePublicationId: payload.publication_id,
      publicReferenceCode: payload.reference_code,
      aggregateVersion: event.aggregate_version,
      profileId: profile.id,
      whatsappContactId: contact.id,
      taxonomyVersion: payload.taxonomy_version,
      subcategoryCode: payload.subcategory,
      category: payload.category,
      title: payload.title,
      description: payload.description,
      cityRegency: payload.location.city_regency,
      province: payload.location.province,
      availability: payload.availability,
      state: existingPublication?.state === "QUARANTINED" ? "QUARANTINED" : "PUBLISHED",
      publishedAt: new Date(payload.published_at),
      publicUpdatedAt: new Date(payload.public_updated_at),
      lastConfirmedAt: new Date(payload.availability_confirmed_at),
      nextReconfirmationAt: new Date(payload.next_confirmation_at),
      payloadChecksum: event.payload_checksum,
    },
    update: {
      publicReferenceCode: payload.reference_code,
      aggregateVersion: event.aggregate_version,
      profileId: profile.id,
      whatsappContactId: contact.id,
      taxonomyVersion: payload.taxonomy_version,
      subcategoryCode: payload.subcategory,
      category: payload.category,
      title: payload.title,
      description: payload.description,
      cityRegency: payload.location.city_regency,
      province: payload.location.province,
      availability: payload.availability,
      state: existingPublication?.state === "QUARANTINED" ? "QUARANTINED" : "PUBLISHED",
      publishedAt: new Date(payload.published_at),
      publicUpdatedAt: new Date(payload.public_updated_at),
      lastConfirmedAt: new Date(payload.availability_confirmed_at),
      nextReconfirmationAt: new Date(payload.next_confirmation_at),
      payloadChecksum: event.payload_checksum,
      unpublishedAt: null,
      archivedAt: null,
    },
  });

  if (existingPublication?.state === "QUARANTINED") {
    await rememberDesiredStateDuringQuarantine(
      transaction,
      event.institution_id,
      "PUBLICATION",
      existingPublication.id,
      "PUBLISHED",
    );
  }

  await replaceCategoryDetail(
    transaction,
    publication.id,
    event.institution_id,
    payload.category,
    payload.attributes,
  );
  await transaction.publicationMedia.deleteMany({ where: { publicationId: publication.id } });
  await transaction.publicationMedia.createMany({
    data: payload.media.map((item: any) => ({
      institutionId: event.institution_id,
      publicationId: publication.id,
      mediaObjectId: item.media_id,
      sortOrder: item.position,
      isCover: item.is_cover,
      altText: item.alt_text,
    })),
  });
  await transaction.centralJob.upsert({
    where: { dedupeKey: "projection:" + publication.id + ":" + event.aggregate_version },
    create: {
      institutionId: event.institution_id,
      jobType: "REBUILD_PUBLICATION_PROJECTION",
      dedupeKey: "projection:" + publication.id + ":" + event.aggregate_version,
      payload: { publication_id: publication.id },
    },
    update: {},
  });
}

async function unpublishOrArchive(transaction: TransactionClient, event: IntegrationEvent) {
  const payload = event.payload as any;
  const archive = event.event_type === "ARCHIVE_PUBLICATION";
  const publication = await transaction.publication.findUnique({
    where: {
      institutionId_sourcePublicationId: {
        institutionId: event.institution_id,
        sourcePublicationId: payload.publication_id,
      },
    },
  });
  if (!publication) return;
  const desiredState = archive ? "ARCHIVED" : "UNPUBLISHED";
  await transaction.publication.update({
    where: { id: publication.id },
    data: archive
      ? {
          state: publication.state === "QUARANTINED" ? "QUARANTINED" : "ARCHIVED",
          aggregateVersion: event.aggregate_version,
          archivedAt: new Date(payload.archived_at),
        }
      : {
          state: publication.state === "QUARANTINED" ? "QUARANTINED" : "UNPUBLISHED",
          aggregateVersion: event.aggregate_version,
          unpublishedAt: new Date(payload.unpublished_at),
        },
  });
  if (publication.state === "QUARANTINED") {
    await rememberDesiredStateDuringQuarantine(
      transaction,
      event.institution_id,
      "PUBLICATION",
      publication.id,
      desiredState,
    );
  }
}

async function revokeMedia(transaction: TransactionClient, event: IntegrationEvent) {
  const payload = event.payload as any;
  const media = await transaction.mediaObject.findFirst({
    where: { id: payload.media_id, institutionId: event.institution_id },
  });
  if (!media) return;
  await transaction.mediaObject.update({
    where: { id: media.id },
    data: {
      state: media.state === "QUARANTINED" ? "QUARANTINED" : "REVOKED",
      revokedAt: new Date(payload.revoked_at),
    },
  });
  if (media.state === "QUARANTINED") {
    await rememberDesiredStateDuringQuarantine(
      transaction,
      event.institution_id,
      "MEDIA",
      media.id,
      "REVOKED",
    );
  }
  const covers = await transaction.publicationMedia.findMany({
    where: { institutionId: event.institution_id, mediaObjectId: media.id, isCover: true },
    select: { publicationId: true },
  });
  if (covers.length > 0) {
    const coverPublications = await transaction.publication.findMany({
      where: { id: { in: covers.map((item) => item.publicationId) }, state: "QUARANTINED" },
      select: { id: true },
    });
    await transaction.publication.updateMany({
      where: { id: { in: covers.map((item) => item.publicationId) }, state: "PUBLISHED" },
      data: { state: "UNPUBLISHED", unpublishedAt: new Date(payload.revoked_at) },
    });
    for (const publication of coverPublications) {
      await transaction.publication.update({
        where: { id: publication.id },
        data: { unpublishedAt: new Date(payload.revoked_at) },
      });
      await rememberDesiredStateDuringQuarantine(
        transaction,
        event.institution_id,
        "PUBLICATION",
        publication.id,
        "UNPUBLISHED",
      );
    }
  }
}

async function applyBusinessEvent(transaction: TransactionClient, event: IntegrationEvent) {
  if (event.event_type === "UPSERT_BPRS_PROFILE") return applyProfile(transaction, event);
  if (event.event_type === "UPSERT_WHATSAPP_CONTACT") return applyContact(transaction, event);
  if (event.event_type === "REVOKE_WHATSAPP_CONTACT") return revokeContact(transaction, event);
  if (event.event_type === "UPSERT_PUBLICATION_SNAPSHOT") return applyPublication(transaction, event);
  if (["UNPUBLISH_PUBLICATION", "ARCHIVE_PUBLICATION"].includes(event.event_type)) {
    return unpublishOrArchive(transaction, event);
  }
  if (event.event_type === "REVOKE_MEDIA") return revokeMedia(transaction, event);
  throw new ApiError(422, "EVENT_TYPE_UNSUPPORTED", "Jenis perubahan belum didukung kontrak ini.");
}

export class IngestService {
  constructor(private databases: DatabaseClients) {}

  async ingest(event: IntegrationEvent, authentication: {
    institutionId: string;
    installationId: string;
    keyId: string;
    nonceHash: string;
    requestTimestamp: Date;
  }) {
    if (event.institution_id !== authentication.institutionId) {
      throw new ApiError(403, "INSTITUTION_MISMATCH", "Identitas BPRS tidak sesuai koneksi.");
    }
    return withInstitution(
      this.databases.ingest,
      authentication.institutionId,
      async (transaction) => {
        const existing = await transaction.ingestEvent.findUnique({
          where: { eventId: event.event_id },
        });
        if (existing) {
          if (
            existing.institutionId === event.institution_id
            && existing.payloadChecksum === event.payload_checksum
          ) {
            return {
              status: "DUPLICATE" as const,
              activeAggregateVersion: existing.aggregateVersion,
            };
          }
          throw new ApiError(409, "EVENT_ID_CONFLICT", "Event ID sudah digunakan untuk isi berbeda.");
        }

        const cursor = await transaction.aggregateCursor.findUnique({
          where: {
            institutionId_aggregateId: {
              institutionId: event.institution_id,
              aggregateId: event.aggregate_id,
            },
          },
        });
        if (cursor && event.aggregate_version <= cursor.aggregateVersion) {
          throw new ApiError(409, "AGGREGATE_VERSION_CONFLICT", "Versi data lebih lama dari versi yang sudah diterima.");
        }

        await transaction.ingestEvent.create({
          data: {
            eventId: event.event_id,
            institutionId: event.institution_id,
            installationId: authentication.installationId,
            keyId: authentication.keyId,
            aggregateType: aggregateType(event.event_type),
            aggregateId: event.aggregate_id,
            aggregateVersion: event.aggregate_version,
            eventType: event.event_type,
            schemaVersion: event.schema_version,
            payloadChecksum: event.payload_checksum,
            payload: asJson(event.payload),
            requestTimestamp: authentication.requestTimestamp,
            nonceHash: authentication.nonceHash,
            state: "RECEIVED",
          },
        });

        await applyBusinessEvent(transaction, event);
        await transaction.aggregateCursor.upsert({
          where: {
            institutionId_aggregateId: {
              institutionId: event.institution_id,
              aggregateId: event.aggregate_id,
            },
          },
          create: {
            institutionId: event.institution_id,
            aggregateType: aggregateType(event.event_type),
            aggregateId: event.aggregate_id,
            aggregateVersion: event.aggregate_version,
            expectedState: expectedState(event.event_type),
            payloadChecksum: event.payload_checksum,
          },
          update: {
            aggregateType: aggregateType(event.event_type),
            aggregateVersion: event.aggregate_version,
            expectedState: expectedState(event.event_type),
            payloadChecksum: event.payload_checksum,
          },
        });
        await transaction.ingestEvent.update({
          where: { eventId: event.event_id },
          data: { state: "APPLIED", processedAt: new Date() },
        });
        await transaction.institutionInstallation.update({
          where: { id: authentication.installationId },
          data: { lastSeenAt: new Date() },
        });
        return { status: "APPLIED" as const, activeAggregateVersion: event.aggregate_version };
      },
      { isolationLevel: "Serializable" },
    );
  }
}
