import { createHash } from "node:crypto";
import type { Logger } from "pino";
import type { StorageAdapter } from "@seputarjaminan/storage";
import type { WorkerDatabase } from "./database.js";
import { withInstitution } from "./database.js";
import { MediaValidationError, streamToLimitedBuffer, transformPublicImage } from "./image-processing.js";
import type { MalwareScanner } from "./malware-scanner.js";
import { compareManifest, type ManifestItem } from "./reconciliation.js";

type ClaimedJob = {
  id: string;
  institution_id: string | null;
  job_type: string;
  payload: any;
  attempt_count: number;
};

class JobDeferredError extends Error {
  constructor() {
    super("Job ditunda karena subject masih dikarantina.");
    this.name = "JobDeferredError";
  }
}

export class CentralWorker {
  private stopping = false;

  constructor(
    private database: WorkerDatabase,
    private storage: StorageAdapter,
    private scanner: MalwareScanner,
    private logger: Logger,
    private maxMediaBytes: number,
  ) {}

  stop() { this.stopping = true; }

  async claimJob(): Promise<ClaimedJob | null> {
    const rows = await this.database.$queryRaw<ClaimedJob[]>`
      UPDATE central_jobs
         SET state = 'PROCESSING'::central_job_state,
             lease_until = now() + interval '2 minutes',
             attempt_count = attempt_count + 1,
             updated_at = now()
       WHERE id = (
         SELECT id
           FROM central_jobs
          WHERE (
            state IN ('PENDING'::central_job_state, 'RETRY_WAIT'::central_job_state)
            OR (state = 'PROCESSING'::central_job_state AND lease_until < now())
          )
            AND available_at <= now()
          ORDER BY available_at ASC, created_at ASC
          FOR UPDATE SKIP LOCKED
          LIMIT 1
       )
       RETURNING id, institution_id, job_type, payload, attempt_count
    `;
    return rows[0] || null;
  }

  private async processMedia(job: ClaimedJob) {
    const institutionId = job.institution_id!;
    const mediaId = String(job.payload.media_id);
    const media = await withInstitution(this.database, institutionId, (transaction) =>
      transaction.mediaObject.findFirst({ where: { id: mediaId, institutionId } }),
    );
    if (!media || media.state === "REVOKED") return;
    if (media.state === "QUARANTINED") throw new JobDeferredError();
    if (media.state === "READY") return;
    const stored = await this.storage.readObject(media.logicalObjectKey);
    const source = await streamToLimitedBuffer(stored.body, this.maxMediaBytes);
    const sourceChecksum = createHash("sha256").update(source).digest("hex");
    if (sourceChecksum !== media.sha256) {
      throw new MediaValidationError("MEDIA_CHECKSUM_MISMATCH", "Checksum media berubah sebelum pemrosesan.");
    }
    await this.scanner.scan(source);
    const transformed = await transformPublicImage(source);
    const originalKey = ["institutions", institutionId, "media", media.id, "original"].join("/");
    const deliveryKey = ["institutions", institutionId, "media", media.id, "main"].join("/");
    if (await this.storage.objectExists(media.logicalObjectKey)) {
      await this.storage.moveObject(media.logicalObjectKey, originalKey);
    } else if (!(await this.storage.objectExists(originalKey))) {
      throw new Error("Media sumber tidak tersedia untuk retry yang aman.");
    }
    await this.storage.putObject(deliveryKey, transformed.bytes, {
      maxBytes: this.maxMediaBytes,
      expectedSha256: transformed.sha256,
      contentType: transformed.mime,
    });
    await withInstitution(this.database, institutionId, (transaction) =>
      transaction.mediaObject.update({
        where: { id: media.id },
        data: {
          logicalObjectKey: originalKey,
          deliveryObjectKey: deliveryKey,
          deliveryMime: transformed.mime,
          deliverySha256: transformed.sha256,
          deliverySizeBytes: BigInt(transformed.sizeBytes),
          deliveryWidth: transformed.width,
          deliveryHeight: transformed.height,
          derivativeMetadata: {
            main: {
              mime: transformed.mime,
              width: transformed.width,
              height: transformed.height,
              size_bytes: transformed.sizeBytes,
              sha256: transformed.sha256,
            },
          },
          scanResult: "CLEAN",
          state: "READY",
          readyAt: new Date(),
        },
      }),
    );
  }

  private async rebuildProjection(job: ClaimedJob) {
    const institutionId = job.institution_id!;
    const publicationId = String(job.payload.publication_id);
    await withInstitution(this.database, institutionId, async (transaction) => {
      const publication = await transaction.publication.findFirst({
        where: { id: publicationId, institutionId },
        include: { media: { where: { isCover: true, mediaObject: { state: "READY" } } } },
      });
      if (!publication || publication.state !== "PUBLISHED" || publication.media.length !== 1) {
        await transaction.publicSearchDocument.deleteMany({ where: { publicationId } });
        return;
      }
      const normalizedText = [
        publication.title,
        publication.description,
        publication.cityRegency,
        publication.province,
        publication.subcategoryCode,
      ].join(" ").normalize("NFKC").toLocaleLowerCase("id-ID");
      await transaction.publicSearchDocument.upsert({
        where: { publicationId },
        create: {
          publicationId,
          institutionId,
          normalizedText,
          filterDocument: {
            category: publication.category,
            subcategory: publication.subcategoryCode,
            city_regency: publication.cityRegency,
            province: publication.province,
          },
          coverMediaId: publication.media[0].mediaObjectId,
          projectionVersion: publication.aggregateVersion,
        },
        update: {
          normalizedText,
          filterDocument: {
            category: publication.category,
            subcategory: publication.subcategoryCode,
            city_regency: publication.cityRegency,
            province: publication.province,
          },
          coverMediaId: publication.media[0].mediaObjectId,
          projectionVersion: publication.aggregateVersion,
        },
      });
    });
  }

  private async reconcile(job: ClaimedJob) {
    const institutionId = job.institution_id!;
    const runId = String(job.payload.reconciliation_run_id);
    await withInstitution(this.database, institutionId, async (transaction) => {
      const run = await transaction.reconciliationRun.findFirst({ where: { id: runId, institutionId } });
      if (!run) return;
      await transaction.reconciliationRun.update({
        where: { id: run.id },
        data: { state: "RUNNING", startedAt: new Date() },
      });
      const manifest = run.manifest as any;
      const items = manifest.items as ManifestItem[];
      const cursors = await transaction.aggregateCursor.findMany({
        where: { institutionId, aggregateId: { in: items.map((item) => item.aggregate_id) } },
      });
      const mismatches = compareManifest(items, cursors);
      await transaction.reconciliationRun.update({
        where: { id: run.id },
        data: {
          state: "COMPLETED",
          countChecked: items.length,
          countMismatch: mismatches.length,
          safeMismatchReport: mismatches,
          finishedAt: new Date(),
        },
      });
    });
  }

  private async execute(job: ClaimedJob) {
    if (job.job_type === "PROCESS_MEDIA") return this.processMedia(job);
    if (job.job_type === "REBUILD_PUBLICATION_PROJECTION") return this.rebuildProjection(job);
    if (job.job_type === "RECONCILE_MANIFEST") return this.reconcile(job);
    throw new Error("Unknown central job type: " + job.job_type);
  }

  private async complete(job: ClaimedJob) {
    await this.database.centralJob.update({
      where: { id: job.id },
      data: { state: "COMPLETED", leaseUntil: null, lastErrorCode: null },
    });
  }

  private async fail(job: ClaimedJob, error: any) {
    if (error instanceof JobDeferredError) {
      await this.database.centralJob.update({
        where: { id: job.id },
        data: {
          state: "RETRY_WAIT",
          leaseUntil: null,
          availableAt: new Date(Date.now() + 5 * 60 * 1000),
          attemptCount: { decrement: 1 },
          lastErrorCode: "SUBJECT_QUARANTINED",
        },
      });
      return;
    }
    const safeCode = error instanceof MediaValidationError ? error.code : "WORKER_TEMPORARY_FAILURE";
    if (error instanceof MediaValidationError && job.job_type === "PROCESS_MEDIA" && job.institution_id) {
      await withInstitution(this.database, job.institution_id, (transaction) =>
        transaction.mediaObject.updateMany({
          where: { id: String(job.payload.media_id), institutionId: job.institution_id! },
          data: { state: "REJECTED", scanResult: safeCode },
        }),
      );
      await this.database.centralJob.update({
        where: { id: job.id },
        data: { state: "COMPLETED", leaseUntil: null, lastErrorCode: safeCode },
      });
      return;
    }
    const dead = job.attempt_count >= 5;
    const delaySeconds = Math.min(300, 2 ** job.attempt_count * 5);
    await this.database.centralJob.update({
      where: { id: job.id },
      data: {
        state: dead ? "DEAD_LETTER" : "RETRY_WAIT",
        leaseUntil: null,
        availableAt: new Date(Date.now() + delaySeconds * 1000),
        lastErrorCode: safeCode,
      },
    });
  }

  async maintenance() {
    await this.database.publication.updateMany({
      where: {
        state: "PUBLISHED",
        nextReconfirmationAt: { lte: new Date() },
      },
      data: { state: "UNPUBLISHED", unpublishedAt: new Date() },
    });
    await this.database.requestNonce.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    const cleanupBefore = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const staleSessions = await this.database.mediaUploadSession.findMany({
      where: {
        expiresAt: { lt: cleanupBefore },
        mediaObject: { state: { in: ["AWAITING_UPLOAD", "EXPIRED", "REJECTED"] } },
      },
      include: { mediaObject: true },
    });
    for (const session of staleSessions) {
      if (await this.storage.objectExists(session.mediaObject.logicalObjectKey)) {
        await this.storage.deleteTemporaryObject(session.mediaObject.logicalObjectKey);
      }
    }
    if (staleSessions.length > 0) {
      const sessionIds = staleSessions.map((session) => session.id);
      const mediaIds = staleSessions.map((session) => session.mediaObjectId);
      await this.database.$transaction([
        this.database.mediaObject.updateMany({
          where: { id: { in: mediaIds }, state: "AWAITING_UPLOAD" },
          data: { state: "EXPIRED" },
        }),
        this.database.mediaUploadSession.deleteMany({ where: { id: { in: sessionIds } } }),
      ]);
    }
  }

  async runOnce() {
    const job = await this.claimJob();
    if (!job) return false;
    try {
      await this.execute(job);
      await this.complete(job);
    } catch (error) {
      this.logger.error({ job_id: job.id, job_type: job.job_type, error_name: (error as any)?.name }, "central_job_failed");
      await this.fail(job, error);
    }
    return true;
  }

  async run() {
    let lastMaintenance = 0;
    while (!this.stopping) {
      if (Date.now() - lastMaintenance > 60000) {
        await this.maintenance();
        lastMaintenance = Date.now();
      }
      const found = await this.runOnce();
      if (!found) await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}
