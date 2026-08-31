import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Request } from "express";
import {
  validateSchema,
} from "@seputarjaminan/contracts";
import type { DatabaseClients } from "./database.js";
import { withInstitution } from "./database.js";
import { ApiError } from "./errors.js";

const UPLOAD_SCHEMA = "https://seputarjaminan.com/contracts/v1/media-upload-session-request.schema.json";

function tokenHash(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export class MediaService {
  constructor(
    private databases: DatabaseClients,
    private storage: any,
    private config: {
      publicApiBaseUrl: string;
      uploadSessionTtlSeconds: number;
      security: { mediaFileMaxBytes: number; mediaTotalMaxBytes: number };
      storage: { provider: "FILESYSTEM" | "S3_COMPATIBLE" };
    },
  ) {}

  async createUploadSession(payload: any, authentication: {
    institutionId: string;
  }, requestId: string) {
    const validation = validateSchema(UPLOAD_SCHEMA, payload);
    if (!validation.valid) {
      throw new ApiError(422, "MEDIA_SESSION_INVALID", "Data gambar belum lengkap atau tidak valid.", {
        fieldErrors: validation.errors.map((error: any) => ({
          field: error.path,
          code: String(error.keyword).toUpperCase(),
          message: error.message,
        })),
      });
    }
    if (payload.institution_id !== authentication.institutionId) {
      throw new ApiError(403, "INSTITUTION_MISMATCH", "Identitas BPRS tidak sesuai koneksi.");
    }
    const expiresIn = Math.min(payload.requested_ttl_seconds, this.config.uploadSessionTtlSeconds);
    const expiresAt = new Date(Date.now() + expiresIn * 1000);
    const plainToken = randomBytes(32).toString("base64url");

    const result = await withInstitution(
      this.databases.ingest,
      authentication.institutionId,
      async (transaction) => {
        const existing = await transaction.mediaObject.findUnique({
          where: {
            institutionId_sourceMediaId: {
              institutionId: authentication.institutionId,
              sourceMediaId: payload.source_media_id,
            },
          },
        });
        if (
          existing
          && (
            existing.sha256 !== payload.sha256
            || existing.detectedMime !== payload.detected_mime
            || Number(existing.sizeBytes) !== payload.size_bytes
            || existing.sourcePublicationId !== payload.publication_id
            || existing.purpose !== payload.purpose
          )
        ) {
          throw new ApiError(409, "SOURCE_MEDIA_CONFLICT", "Identitas gambar sudah digunakan untuk file berbeda.");
        }
        if (existing && ["READY", "PROCESSING", "REVOKED"].includes(existing.state)) {
          throw new ApiError(409, "MEDIA_STATE_CONFLICT", "Gambar sudah diproses atau tidak dapat diunggah ulang.");
        }

        if (payload.publication_id) {
          const siblings = await transaction.mediaObject.findMany({
            where: {
              institutionId: authentication.institutionId,
              sourcePublicationId: payload.publication_id,
              state: { notIn: ["REJECTED", "REVOKED", "EXPIRED"] },
            },
            select: { id: true, sizeBytes: true },
          });
          const other = siblings.filter((item) => item.id !== existing?.id);
          if (other.length >= 10) {
            throw new ApiError(422, "MEDIA_COUNT_LIMIT", "Maksimal 10 gambar untuk satu katalog.");
          }
          const total = other.reduce((sum, item) => sum + Number(item.sizeBytes), 0) + payload.size_bytes;
          if (total > this.config.security.mediaTotalMaxBytes) {
            throw new ApiError(422, "MEDIA_TOTAL_SIZE_LIMIT", "Total ukuran gambar melebihi batas 50 MB.");
          }
        }

        const mediaId = existing?.id || randomUUID();
        const logicalObjectKey = [
          "institutions",
          authentication.institutionId,
          "temporary",
          mediaId,
          "source",
        ].join("/");
        const media = existing || await transaction.mediaObject.create({
          data: {
            id: mediaId,
            institutionId: authentication.institutionId,
            sourceMediaId: payload.source_media_id,
            sourcePublicationId: payload.publication_id,
            logicalObjectKey,
            storageBackend: this.config.storage.provider,
            purpose: payload.purpose,
            state: "AWAITING_UPLOAD",
            sha256: payload.sha256,
            detectedMime: payload.detected_mime,
            sizeBytes: BigInt(payload.size_bytes),
            width: payload.width,
            height: payload.height,
          },
        });
        const session = await transaction.mediaUploadSession.create({
          data: {
            institutionId: authentication.institutionId,
            mediaObjectId: media.id,
            tokenHash: tokenHash(plainToken),
            expectedSha256: payload.sha256,
            expectedMime: payload.detected_mime,
            maxBytes: BigInt(Math.min(payload.size_bytes, this.config.security.mediaFileMaxBytes)),
            expiresAt,
          },
        });
        return { media, session };
      },
      { isolationLevel: "Serializable" },
    );

    let uploadUrl = this.config.publicApiBaseUrl
      + "/v1/media/upload-sessions/" + result.session.id + "/content";
    let headers: Record<string, string> = {
      "Content-Type": payload.detected_mime,
      "X-SJ-Institution-Id": authentication.institutionId,
      "X-SJ-Upload-Token": plainToken,
    };
    if (
      this.config.storage.provider === "S3_COMPATIBLE"
      && typeof this.storage.createPresignedUpload === "function"
    ) {
      uploadUrl = await this.storage.createPresignedUpload({
        logicalKey: result.media.logicalObjectKey,
        contentType: payload.detected_mime,
        checksumSha256: payload.sha256,
        expiresSeconds: expiresIn,
      });
      headers = {
        "Content-Type": payload.detected_mime,
        "x-amz-checksum-sha256": Buffer.from(payload.sha256, "hex").toString("base64"),
      };
    }

    return {
      request_id: requestId,
      media_id: result.media.id,
      upload_session_id: result.session.id,
      upload_url: uploadUrl,
      method: "PUT",
      headers,
      expires_at: expiresAt.toISOString(),
      max_bytes: Number(result.session.maxBytes),
    };
  }

  async uploadFilesystemContent(request: Request) {
    if (this.config.storage.provider !== "FILESYSTEM") {
      throw new ApiError(404, "UPLOAD_ROUTE_NOT_ACTIVE", "Route upload tidak tersedia untuk provider aktif.");
    }
    const institutionId = request.get("X-SJ-Institution-Id");
    const token = request.get("X-SJ-Upload-Token");
    const sessionId = String(request.params.sessionId);
    if (!institutionId || !token || !sessionId) {
      throw new ApiError(401, "UPLOAD_TOKEN_REQUIRED", "Sesi upload tidak dapat diverifikasi.");
    }
    if (!Buffer.isBuffer(request.body)) {
      throw new ApiError(400, "MEDIA_BODY_REQUIRED", "File gambar belum dikirim.");
    }
    const session = await withInstitution(this.databases.ingest, institutionId, (transaction) =>
      transaction.mediaUploadSession.findFirst({
        where: {
          id: sessionId,
          institutionId,
          tokenHash: tokenHash(token),
        },
        include: { mediaObject: true },
      }),
    );
    if (!session || session.expiresAt <= new Date() || session.consumedAt) {
      throw new ApiError(404, "UPLOAD_SESSION_INVALID", "Sesi upload tidak tersedia atau sudah berakhir.");
    }
    if (request.get("Content-Type") !== session.expectedMime) {
      throw new ApiError(415, "MEDIA_TYPE_MISMATCH", "Format gambar tidak sesuai sesi upload.");
    }
    await this.storage.putObject(session.mediaObject.logicalObjectKey, request.body, {
      maxBytes: Number(session.maxBytes),
      expectedSha256: session.expectedSha256,
      contentType: session.expectedMime,
    });
    try {
      await withInstitution(this.databases.ingest, institutionId, async (transaction) => {
        await transaction.mediaUploadSession.update({
          where: { id: session.id },
          data: { consumedAt: new Date() },
        });
        await transaction.mediaObject.update({
          where: { id: session.mediaObjectId },
          data: { state: "UPLOADED" },
        });
      });
    } catch (error) {
      await this.storage.deleteTemporaryObject(session.mediaObject.logicalObjectKey).catch(() => undefined);
      throw error;
    }
  }

  async complete(sessionId: string, mediaId: string, institutionId: string, requestId: string) {
    const result = await withInstitution(this.databases.ingest, institutionId, async (transaction) => {
      const session = await transaction.mediaUploadSession.findFirst({
        where: { id: sessionId, institutionId, mediaObjectId: mediaId },
        include: { mediaObject: true },
      });
      if (!session || session.expiresAt <= new Date()) {
        throw new ApiError(404, "UPLOAD_SESSION_INVALID", "Sesi upload tidak tersedia atau sudah berakhir.");
      }
      if (this.config.storage.provider === "S3_COMPATIBLE") {
        const exists = await this.storage.objectExists(session.mediaObject.logicalObjectKey);
        if (!exists) {
          throw new ApiError(409, "MEDIA_UPLOAD_INCOMPLETE", "Upload gambar belum selesai.");
        }
      } else if (!session.consumedAt) {
        throw new ApiError(409, "MEDIA_UPLOAD_INCOMPLETE", "Upload gambar belum selesai.");
      }
      if (session.mediaObject.state === "READY") return session.mediaObject;
      if (!["UPLOADED", "AWAITING_UPLOAD", "PROCESSING"].includes(session.mediaObject.state)) {
        throw new ApiError(409, "MEDIA_STATE_CONFLICT", "Gambar tidak dapat diproses pada status saat ini.");
      }
      const media = await transaction.mediaObject.update({
        where: { id: mediaId },
        data: { state: "PROCESSING" },
      });
      await transaction.centralJob.upsert({
        where: { dedupeKey: "media-process:" + mediaId },
        create: {
          institutionId,
          jobType: "PROCESS_MEDIA",
          dedupeKey: "media-process:" + mediaId,
          payload: { media_id: mediaId },
        },
        update: { state: "PENDING", availableAt: new Date(), leaseUntil: null },
      });
      return media;
    });
    return {
      request_id: requestId,
      media_id: result.id,
      status: result.state,
      rejection_code: result.scanResult || null,
      checked_at: new Date().toISOString(),
    };
  }

  async status(mediaId: string, institutionId: string, requestId: string) {
    const media = await withInstitution(this.databases.ingest, institutionId, (transaction) =>
      transaction.mediaObject.findFirst({ where: { id: mediaId, institutionId } }),
    );
    if (!media) throw new ApiError(404, "MEDIA_NOT_FOUND", "Gambar tidak tersedia.");
    return {
      request_id: requestId,
      media_id: media.id,
      status: media.state,
      rejection_code: media.state === "REJECTED" ? media.scanResult : null,
      checked_at: new Date().toISOString(),
    };
  }
}
