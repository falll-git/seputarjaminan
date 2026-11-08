import { createHash, randomUUID } from "node:crypto";
import type { Logger } from "pino";
import type { StorageAdapter } from "@seputarjaminan/storage";
import type { WorkerDatabase } from "./database.js";
import { withInstitution } from "./database.js";
import { MediaValidationError, streamToLimitedBuffer, transformPublicImage } from "./image-processing.js";
import type { MalwareScanner } from "./malware-scanner.js";
import { compareManifest, type ManifestItem } from "./reconciliation.js";
import { actualStateMismatches } from "./reconciliation-state.js";
import { assertLease, renewLease, LeaseLostError, type ClaimedJob } from "./job-lease.js";

class JobDeferredError extends Error {
  constructor() {
    super("Job ditunda karena subject masih dikarantina.");
    this.name = "JobDeferredError";
  }
}

export class CentralWorker {
  private stopping = false;
  private lastProgressAt = 0;
  private activeJob = false;

  progress() { return { lastProgressAt: this.lastProgressAt, activeJob: this.activeJob, stopping: this.stopping }; }

  constructor(
    private database: WorkerDatabase,
    private storage: StorageAdapter,
    private scanner: MalwareScanner,
    private logger: Logger,
    private maxMediaBytes: number,
    private timing: { leaseMs: number; renewMs: number; idleMs: number; retryBaseMs?: number; quarantineMs?: number; jobTimeoutMs?: number } = { leaseMs: 120000, renewMs: 30000, idleMs: 1000 },
  ) {}

  stop() { this.stopping = true; }

  async claimJob(): Promise<ClaimedJob | null> {
    if (this.stopping) return null;
    // Repeated hard crashes also consume the retry budget; they cannot loop forever.
    await this.database.$executeRaw`
      UPDATE central_jobs SET state='DEAD_LETTER', lease_until=NULL, lease_token=NULL,
        last_error_code='WORKER_LEASE_EXHAUSTED', updated_at=clock_timestamp()
      WHERE state='PROCESSING' AND (lease_until IS NULL OR lease_until<clock_timestamp()) AND attempt_count>=5
    `;
    const token = randomUUID();
    const rows = await this.database.$queryRaw<ClaimedJob[]>`
      UPDATE central_jobs
         SET state = 'PROCESSING'::central_job_state,
             lease_until = clock_timestamp() + ${this.timing.leaseMs} * interval '1 millisecond',
             lease_token = ${token}::uuid,
             attempt_count = attempt_count + 1,
             updated_at = now()
       WHERE id = (
         SELECT id
           FROM central_jobs
          WHERE (
            state IN ('PENDING'::central_job_state, 'RETRY_WAIT'::central_job_state)
            OR (state = 'PROCESSING'::central_job_state AND (lease_until IS NULL OR lease_until < now()))
          )
            AND available_at <= now()
          ORDER BY available_at ASC, created_at ASC, id ASC
          FOR UPDATE SKIP LOCKED
          LIMIT 1
       )
       RETURNING id, institution_id, job_type, payload, attempt_count, lease_token
    `;
    return rows[0] || null;
  }

  private async fenced<T>(job: ClaimedJob, handler: Parameters<typeof withInstitution<T>>[2]) {
    return withInstitution(this.database, job.institution_id!, async transaction => {
      // Same subject-first order as ingest and upload completion.
      if (job.job_type === "PROCESS_MEDIA") {
        await transaction.$queryRaw`SELECT id FROM media_objects WHERE id=${String(job.payload.media_id)}::uuid FOR UPDATE`;
      } else if (job.job_type === "REBUILD_PUBLICATION_PROJECTION") {
        await transaction.$queryRaw`SELECT id FROM publications WHERE id=${String(job.payload.publication_id)}::uuid FOR UPDATE`;
      }
      await assertLease(transaction, job);
      return handler(transaction);
    }, job.job_type === "RECONCILE_MANIFEST" ? { isolationLevel: "RepeatableRead" } : {});
  }

  private async processMedia(job: ClaimedJob) {
    const institutionId = job.institution_id!;
    const mediaId = String(job.payload.media_id);
    const media = await withInstitution(this.database, institutionId, (transaction) =>
      transaction.mediaObject.findFirst({ where: { id: mediaId, institutionId } }),
    );
    if (!media || media.state === "REVOKED") return;
    if (media.state === "QUARANTINED") throw new JobDeferredError();
    if (media.state !== "PROCESSING") return;
    const originalKey = ["institutions", institutionId, "media", media.id, "original"].join("/");
    const staleBefore = new Date(Date.now() - 86400000);
    for (const key of [media.logicalObjectKey, ...["main", "card", "thumb"].map(v => originalKey.replace(/original$/, v))]) {
      await this.storage.cleanupTransientWrites?.(key, staleBefore);
    }
    // A prior attempt may already have moved the source before failing to write
    // derivatives. Retry from that original, still verifying the source digest.
    const sourceKey = await this.storage.objectExists(media.logicalObjectKey) ? media.logicalObjectKey : originalKey;
    const stored = await this.storage.readObject(sourceKey);
    const source = await streamToLimitedBuffer(stored.body, this.maxMediaBytes);
    const sourceChecksum = createHash("sha256").update(source).digest("hex");
    if (sourceChecksum !== media.sha256) {
      throw new MediaValidationError("MEDIA_CHECKSUM_MISMATCH", "Checksum media berubah sebelum pemrosesan.");
    }
    await renewLease(this.database, job, this.timing.leaseMs);
    await this.scanner.scan(source);
    this.lastProgressAt = Date.now();
    if (source.length !== Number(media.sizeBytes)) throw new MediaValidationError("MEDIA_SIZE_MISMATCH", "Ukuran gambar berbeda dari sesi upload.");
    const expected = { mime: media.detectedMime, width: media.width, height: media.height };
    const logo = media.purpose === "BPRS_PUBLIC_MARK";
    const transformed = await transformPublicImage(source, expected, { logo });
    const card = await transformPublicImage(source, expected, { size: 960, logo });
    const thumb = await transformPublicImage(source, expected, { size: 320, logo });
    this.lastProgressAt = Date.now();
    const deliveryKey = ["institutions", institutionId, "media", media.id, "main"].join("/");
    await renewLease(this.database, job, this.timing.leaseMs);
    if (sourceKey !== originalKey) {
      try { await this.storage.moveObject(media.logicalObjectKey, originalKey); }
      catch (error: any) {
        // A reclaimed owner may have performed the same immutable move. Never
        // accept some unrelated existing original solely because it exists.
        if (error?.code !== "ENOENT") throw error;
        const original = await this.storage.readObject(originalKey);
        const bytes = await streamToLimitedBuffer(original.body, this.maxMediaBytes);
        if (createHash("sha256").update(bytes).digest("hex") !== media.sha256) throw error;
      }
    } else if (!(await this.storage.objectExists(originalKey))) {
      throw new Error("Media sumber tidak tersedia untuk retry yang aman.");
    }
    await renewLease(this.database, job, this.timing.leaseMs);
    await this.storage.putObject(deliveryKey, transformed.bytes, {
      maxBytes: this.maxMediaBytes,
      expectedSha256: transformed.sha256,
      contentType: transformed.mime,
    });
    for (const [variant, image] of [["card", card], ["thumb", thumb]] as const) {
      await renewLease(this.database, job, this.timing.leaseMs);
      await this.storage.putObject(["institutions", institutionId, "media", media.id, variant].join("/"), image.bytes, {
        maxBytes: this.maxMediaBytes, expectedSha256: image.sha256, contentType: image.mime,
      });
      this.lastProgressAt = Date.now();
    }
    const published = await this.fenced(job, (transaction) =>
      transaction.mediaObject.updateMany({
        where: { id: media.id, state: "PROCESSING" },
        data: {
          logicalObjectKey: originalKey,
          deliveryObjectKey: deliveryKey,
          deliveryMime: transformed.mime,
          deliverySha256: transformed.sha256,
          deliverySizeBytes: BigInt(transformed.sizeBytes),
          deliveryWidth: transformed.width,
          deliveryHeight: transformed.height,
          derivativeMetadata: {
            card: { mime: card.mime, width: card.width, height: card.height, size_bytes: card.sizeBytes, sha256: card.sha256 },
            thumb: { mime: thumb.mime, width: thumb.width, height: thumb.height, size_bytes: thumb.sizeBytes, sha256: thumb.sha256 },
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
    if (!published.count) {
      const current = await withInstitution(this.database, institutionId, transaction => transaction.mediaObject.findFirst({ where: { id: media.id } }));
      if (current?.state === "QUARANTINED") throw new JobDeferredError();
    }
  }

  private async rebuildProjection(job: ClaimedJob) {
    const institutionId = job.institution_id!;
    const publicationId = String(job.payload.publication_id);
    await this.fenced(job, async (transaction) => {
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
    await this.fenced(job, async (transaction) => {
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
      const already = new Set(mismatches.map(item => item.aggregate_id));
      mismatches.push(...await actualStateMismatches(transaction, institutionId, items.filter(item => !already.has(item.aggregate_id))));
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
    await this.finish(job, { state: "COMPLETED", leaseUntil: null, leaseToken: null, lastErrorCode: null });
  }

  private async finish(job: ClaimedJob, data: any) {
    await this.database.$transaction(async tx => {
      await assertLease(tx, job);
      await tx.centralJob.update({ where: { id: job.id }, data: { ...data, leaseToken: null } });
    });
  }

  private async fail(job: ClaimedJob, error: any): Promise<void> {
    if (error instanceof JobDeferredError) {
      await this.finish(job, {
          state: "RETRY_WAIT",
          leaseUntil: null,
          availableAt: new Date(Date.now() + (this.timing.quarantineMs ?? 300000)),
          attemptCount: { decrement: 1 },
          lastErrorCode: "SUBJECT_QUARANTINED",
      });
      return;
    }
    const safeCode = error instanceof MediaValidationError ? error.code : "WORKER_TEMPORARY_FAILURE";
    if (error instanceof MediaValidationError && job.job_type === "PROCESS_MEDIA" && job.institution_id) {
      const current = await withInstitution(this.database, job.institution_id, transaction => transaction.mediaObject.findFirst({ where: { id: String(job.payload.media_id) } }));
      if (current?.state === "QUARANTINED") return this.fail(job, new JobDeferredError());
      const rejected = await this.fenced(job, (transaction) =>
        transaction.mediaObject.updateMany({
          where: { id: String(job.payload.media_id), institutionId: job.institution_id!, state: "PROCESSING" },
          data: { state: "REJECTED", scanResult: safeCode },
        }),
      );
      if (!rejected.count) {
        const latest = await withInstitution(this.database, job.institution_id, transaction => transaction.mediaObject.findFirst({ where: { id: String(job.payload.media_id) } }));
        if (latest?.state === "QUARANTINED") return this.fail(job, new JobDeferredError());
      }
      await this.finish(job, { state: "COMPLETED", leaseUntil: null, lastErrorCode: safeCode });
      return;
    }
    const dead = job.attempt_count >= 5;
    const delayMs = Math.min(300000, 2 ** job.attempt_count * (this.timing.retryBaseMs ?? 5000));
    await this.finish(job, {
        state: dead ? "DEAD_LETTER" : "RETRY_WAIT",
        leaseUntil: null,
        availableAt: new Date(Date.now() + delayMs),
        lastErrorCode: safeCode,
    });
  }

  async maintenance() {
    const expired = await this.database.publication.findMany({
      where: { state: "PUBLISHED", nextReconfirmationAt: { lte: new Date() } },
      select: { id: true, institutionId: true }, take: 100,
      orderBy: [{ nextReconfirmationAt: "asc" }, { id: "asc" }],
    });
    for (const publication of expired) {
      await withInstitution(this.database, publication.institutionId, async transaction => {
        await transaction.$queryRaw`SELECT id FROM publications WHERE id=${publication.id}::uuid FOR UPDATE`;
        const updated = await transaction.publication.updateMany({
          where: { id: publication.id, state: "PUBLISHED", nextReconfirmationAt: { lte: new Date() } },
          data: { state: "UNPUBLISHED", unpublishedAt: new Date() },
        });
        if (updated.count) await transaction.publicSearchDocument.deleteMany({ where: { publicationId: publication.id } });
      });
    }
    await this.database.requestNonce.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    const cleanupBefore = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const staleSessions = await this.database.mediaUploadSession.findMany({
      where: {
        expiresAt: { lt: cleanupBefore },
        mediaObject: {
          state: { in: ["AWAITING_UPLOAD", "EXPIRED", "REJECTED"] },
          uploadSessions: { none: { expiresAt: { gte: cleanupBefore } } },
        },
      },
      include: { mediaObject: true },
    });
    for (const session of staleSessions) {
      await withInstitution(this.database, session.institutionId, async transaction => {
        // Recheck after locking: renewal/PUT may have happened after enumeration.
        await transaction.$queryRaw`SELECT id FROM media_objects WHERE id=${session.mediaObjectId}::uuid FOR UPDATE`;
        const media = await transaction.mediaObject.findFirst({ where: {
          id: session.mediaObjectId,
          state: { in: ["AWAITING_UPLOAD", "EXPIRED", "REJECTED"] },
          uploadSessions: { none: { expiresAt: { gte: cleanupBefore } } },
        } });
        if (!media) return;
        await this.storage.cleanupTransientWrites?.(media.logicalObjectKey, cleanupBefore);
        if ((media.logicalObjectKey.includes("/temporary/") || media.logicalObjectKey.includes("/failed/"))
            && await this.storage.objectExists(media.logicalObjectKey)) await this.storage.deleteTemporaryObject(media.logicalObjectKey);
        await transaction.mediaObject.updateMany({
          where: { id: media.id, state: "AWAITING_UPLOAD" },
          data: { state: "EXPIRED" },
        });
        await transaction.mediaUploadSession.deleteMany({ where: { mediaObjectId: media.id, expiresAt: { lt: cleanupBefore } } });
      });
    }
  }

  async runOnce() {
    const job = await this.claimJob();
    this.lastProgressAt = Date.now();
    if (!job) return false;
    this.activeJob = true;
    let renewal: Promise<void> | undefined;
    let lost = false;
    const timer = setInterval(() => {
      if (renewal || lost) return;
      renewal = renewLease(this.database, job, this.timing.leaseMs)
        .catch(() => { lost = true; })
        .finally(() => { renewal = undefined; });
    }, this.timing.renewMs);
    timer.unref();
    let deadline: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        this.execute(job),
        new Promise<never>((_resolve, reject) => {
          deadline = setTimeout(() => reject(new Error("WORKER_JOB_TIMEOUT")), this.timing.jobTimeoutMs ?? 300000);
        }),
      ]);
      if (lost) throw new LeaseLostError();
      await this.complete(job);
      this.lastProgressAt = Date.now();
    } catch (error) {
      this.logger.error({ job_id: job.id, job_type: job.job_type, error_name: (error as any)?.name }, "central_job_failed");
      if (!lost && !(error instanceof LeaseLostError)) {
        try { await this.fail(job, error); }
        catch (failure) {
          if (!(failure instanceof LeaseLostError)) throw failure;
        }
      }
    } finally {
      clearTimeout(deadline);
      clearInterval(timer);
      await renewal;
      this.activeJob = false;
    }
    return true;
  }

  async run() {
    let lastMaintenance = 0;
    while (!this.stopping) {
      try {
      if (Date.now() - lastMaintenance > 60000) {
        await this.maintenance();
        lastMaintenance = Date.now();
      }
      const found = await this.runOnce();
      if (!found) await new Promise((resolve) => setTimeout(resolve, this.timing.idleMs));
      } catch (error) {
        // A dependency outage must not leave a healthy timer around a dead loop.
        this.logger.error({ error_name: (error as any)?.name }, "worker_loop_unavailable");
        await new Promise(resolve => setTimeout(resolve, this.timing.idleMs));
      }
    }
  }
}
