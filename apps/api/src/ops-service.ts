import { createPublicKey } from "node:crypto";
import { Prisma } from "../../../generated/prisma/client.ts";
import type { DatabaseClients, TransactionClient } from "./database.js";
import { ApiError } from "./errors.js";
import type { OpsPrincipal } from "./ops-auth.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const REASON = /^[A-Z][A-Z0-9_]*$/u;

function requiredText(value: unknown, label: string, max = 200): string {
  if (typeof value !== "string" || value.trim().length < 1 || value.trim().length > max) {
    throw new ApiError(422, "OPS_INPUT_INVALID", `${label} tidak valid.`);
  }
  return value.trim();
}

function requiredUuid(value: unknown, label: string): string {
  const text = requiredText(value, label, 36);
  if (!UUID.test(text)) throw new ApiError(422, "OPS_INPUT_INVALID", `${label} tidak valid.`);
  return text;
}

function reasonInput(input: unknown): { reasonCode: string; safeDetail: string | null } {
  const body = input as { reason_code?: unknown; safe_detail?: unknown };
  const reasonCode = requiredText(body?.reason_code, "Kode alasan", 80);
  if (!REASON.test(reasonCode)) throw new ApiError(422, "OPS_INPUT_INVALID", "Kode alasan tidak valid.");
  if (body.safe_detail !== undefined && body.safe_detail !== null && typeof body.safe_detail !== "string") {
    throw new ApiError(422, "OPS_INPUT_INVALID", "Catatan aman tidak valid.");
  }
  const safeDetail = typeof body.safe_detail === "string" ? body.safe_detail.trim().slice(0, 500) || null : null;
  return { reasonCode, safeDetail };
}

function assertEd25519PublicKey(value: string): void {
  if (/PRIVATE KEY/u.test(value)) throw new ApiError(422, "PUBLIC_KEY_INVALID", "Hanya public key Ed25519 yang boleh disimpan.");
  try {
    const key = createPublicKey(value);
    if (key.type !== "public" || key.asymmetricKeyType !== "ed25519") throw new Error("wrong key type");
  } catch {
    throw new ApiError(422, "PUBLIC_KEY_INVALID", "Public key Ed25519 tidak valid.");
  }
}

function result(requestId: string, status: string, subjectId: string) {
  return { request_id: requestId, status, subject_id: subjectId, recorded_at: new Date().toISOString() };
}

async function audit(
  transaction: TransactionClient,
  principal: OpsPrincipal,
  requestId: string,
  action: string,
  subjectType: string,
  subjectId: string,
  safeMetadata?: Record<string, unknown>,
) {
  await transaction.opsAuditLog.create({
    data: {
      opsUserId: principal.id,
      action,
      subjectType,
      subjectId,
      requestId,
      safeMetadata: safeMetadata ? safeMetadata as Prisma.InputJsonValue : undefined,
    },
  });
}

export class OpsService {
  constructor(private readonly databases: DatabaseClients) {}

  async onboard(input: unknown, principal: OpsPrincipal, requestId: string) {
    const body = input as Record<string, unknown>;
    const legalNameInternal = requiredText(body?.legal_name_internal, "Nama legal", 200);
    const publicSlug = requiredText(body?.public_slug, "Slug publik", 100).toLowerCase();
    if (!SLUG.test(publicSlug)) throw new ApiError(422, "PUBLIC_SLUG_INVALID", "Slug publik tidak valid.");
    const installationName = requiredText(body?.installation_name, "Nama instalasi", 120);
    const publicKey = requiredText(body?.public_key, "Public key", 10_000);
    const keyId = requiredUuid(body?.key_id, "Key ID");
    assertEd25519PublicKey(publicKey);

    try {
      const institution = await this.databases.ops.$transaction(async (transaction) => {
        const created = await transaction.institution.create({
          data: { legalNameInternal, publicSlug, state: "ACTIVE" },
        });
        const installation = await transaction.institutionInstallation.create({
          data: { institutionId: created.id, installationName, state: "ACTIVE", contractVersion: 1 },
        });
        await transaction.institutionKey.create({
          data: { keyId, institutionId: created.id, installationId: installation.id, publicKey, state: "ACTIVE" },
        });
        await audit(transaction, principal, requestId, "INSTITUTION_ONBOARDED", "INSTITUTION", created.id, {
          installation_id: installation.id,
          key_id: keyId,
        });
        return created;
      });
      return result(requestId, "ONBOARDED", institution.id);
    } catch (error: any) {
      if (error?.code === "P2002") throw new ApiError(409, "REGISTRY_CONFLICT", "Slug, nama instalasi, atau key sudah terdaftar.");
      throw error;
    }
  }

  async rotateKey(installationIdValue: unknown, input: unknown, principal: OpsPrincipal, requestId: string) {
    const installationId = requiredUuid(installationIdValue, "Installation ID");
    const body = input as Record<string, unknown>;
    const keyId = requiredUuid(body?.key_id, "Key ID");
    const publicKey = requiredText(body?.public_key, "Public key", 10_000);
    assertEd25519PublicKey(publicKey);
    let validUntil: Date | null = null;
    if (body.valid_until !== undefined && body.valid_until !== null) {
      if (typeof body.valid_until !== "string") throw new ApiError(422, "VALID_UNTIL_INVALID", "Batas rotasi key tidak valid.");
      validUntil = new Date(body.valid_until);
      if (Number.isNaN(validUntil.getTime()) || validUntil <= new Date()) {
        throw new ApiError(422, "VALID_UNTIL_INVALID", "Batas rotasi key harus berada di masa depan.");
      }
    }

    const installation = await this.databases.ops.institutionInstallation.findUnique({ where: { id: installationId } });
    if (!installation) throw new ApiError(404, "INSTALLATION_NOT_FOUND", "Instalasi tidak ditemukan.");
    try {
      await this.databases.ops.$transaction(async (transaction) => {
        await transaction.institutionKey.updateMany({
          where: { installationId, state: { in: ["ACTIVE", "ROTATING"] } },
          data: validUntil
            ? { state: "ROTATING", validUntil }
            : { state: "REVOKED", revokedAt: new Date(), validUntil: new Date() },
        });
        await transaction.institutionKey.create({
          data: {
            keyId,
            institutionId: installation.institutionId,
            installationId,
            publicKey,
            state: "ACTIVE",
          },
        });
        await audit(transaction, principal, requestId, "INSTALLATION_KEY_ROTATED", "INSTITUTION_KEY", keyId, {
          installation_id: installationId,
          overlap_until: validUntil?.toISOString() || null,
        });
      });
      return result(requestId, "KEY_ROTATED", keyId);
    } catch (error: any) {
      if (error?.code === "P2002") throw new ApiError(409, "KEY_CONFLICT", "Key ID sudah terdaftar.");
      throw error;
    }
  }

  async setInstallationState(
    installationIdValue: unknown,
    state: "ACTIVE" | "SUSPENDED",
    input: unknown,
    principal: OpsPrincipal,
    requestId: string,
  ) {
    const installationId = requiredUuid(installationIdValue, "Installation ID");
    const reason = state === "SUSPENDED" ? reasonInput(input) : null;
    const existing = await this.databases.ops.institutionInstallation.findUnique({ where: { id: installationId } });
    if (!existing) throw new ApiError(404, "INSTALLATION_NOT_FOUND", "Instalasi tidak ditemukan.");
    await this.databases.ops.$transaction(async (transaction) => {
      await transaction.institutionInstallation.update({ where: { id: installationId }, data: { state } });
      await audit(transaction, principal, requestId, `INSTALLATION_${state}`, "INSTALLATION", installationId, reason ? {
        reason_code: reason.reasonCode,
        safe_detail: reason.safeDetail,
      } : undefined);
    });
    return result(requestId, state === "ACTIVE" ? "REACTIVATED" : "SUSPENDED", installationId);
  }

  async setInstitutionState(
    institutionIdValue: unknown,
    state: "ACTIVE" | "SUSPENDED",
    input: unknown,
    principal: OpsPrincipal,
    requestId: string,
  ) {
    const institutionId = requiredUuid(institutionIdValue, "Institution ID");
    const reason = state === "SUSPENDED" ? reasonInput(input) : null;
    const existing = await this.databases.ops.institution.findUnique({ where: { id: institutionId } });
    if (!existing) throw new ApiError(404, "INSTITUTION_NOT_FOUND", "Institusi tidak ditemukan.");
    const now = new Date();
    await this.databases.ops.$transaction(async (transaction) => {
      await transaction.institution.update({
        where: { id: institutionId },
        data: { state, suspendedAt: state === "SUSPENDED" ? now : null },
      });
      await audit(transaction, principal, requestId, `INSTITUTION_${state}`, "INSTITUTION", institutionId, reason ? {
        reason_code: reason.reasonCode,
        safe_detail: reason.safeDetail,
      } : undefined);
    });
    return result(requestId, state === "ACTIVE" ? "REACTIVATED" : "SUSPENDED", institutionId);
  }

  async revokeKey(
    installationIdValue: unknown,
    keyIdValue: unknown,
    input: unknown,
    principal: OpsPrincipal,
    requestId: string,
  ) {
    const installationId = requiredUuid(installationIdValue, "Installation ID");
    const keyId = requiredUuid(keyIdValue, "Key ID");
    const reason = reasonInput(input);
    const existing = await this.databases.ops.institutionKey.findFirst({ where: { keyId, installationId } });
    if (!existing) throw new ApiError(404, "KEY_NOT_FOUND", "Key instalasi tidak ditemukan.");
    await this.databases.ops.$transaction(async (transaction) => {
      await transaction.institutionKey.update({
        where: { keyId },
        data: { state: "REVOKED", revokedAt: new Date(), validUntil: new Date() },
      });
      await audit(transaction, principal, requestId, "INSTALLATION_KEY_REVOKED", "INSTITUTION_KEY", keyId, {
        installation_id: installationId,
        reason_code: reason.reasonCode,
        safe_detail: reason.safeDetail,
      });
    });
    return result(requestId, "KEY_REVOKED", keyId);
  }

  async quarantine(input: unknown, principal: OpsPrincipal, requestId: string) {
    const body = input as Record<string, unknown>;
    const institutionId = requiredUuid(body?.institution_id, "Institution ID");
    const subjectId = requiredUuid(body?.subject_id, "Subject ID");
    const subjectType = requiredText(body?.subject_type, "Jenis subject", 20);
    if (!["PROFILE", "PUBLICATION", "MEDIA"].includes(subjectType)) {
      throw new ApiError(422, "SUBJECT_TYPE_INVALID", "Jenis subject karantina tidak valid.");
    }
    const reason = reasonInput(body);
    const quarantine = await this.databases.ops.$transaction(async (transaction) => {
      let previousState: string;
      if (subjectType === "PROFILE") {
        const subject = await transaction.bprsProfile.findFirst({ where: { id: subjectId, institutionId } });
        if (!subject) throw new ApiError(404, "SUBJECT_NOT_FOUND", "Profil tidak ditemukan.");
        if (subject.state === "QUARANTINED") throw new ApiError(409, "SUBJECT_ALREADY_QUARANTINED", "Profil sudah dikarantina.");
        previousState = subject.state;
        await transaction.bprsProfile.update({ where: { id: subjectId }, data: { state: "QUARANTINED" } });
      } else if (subjectType === "PUBLICATION") {
        const subject = await transaction.publication.findFirst({ where: { id: subjectId, institutionId } });
        if (!subject) throw new ApiError(404, "SUBJECT_NOT_FOUND", "Publikasi tidak ditemukan.");
        if (subject.state === "QUARANTINED") throw new ApiError(409, "SUBJECT_ALREADY_QUARANTINED", "Publikasi sudah dikarantina.");
        previousState = subject.state;
        await transaction.publication.update({ where: { id: subjectId }, data: { state: "QUARANTINED" } });
      } else {
        const subject = await transaction.mediaObject.findFirst({ where: { id: subjectId, institutionId } });
        if (!subject) throw new ApiError(404, "SUBJECT_NOT_FOUND", "Media tidak ditemukan.");
        if (subject.state === "QUARANTINED") throw new ApiError(409, "SUBJECT_ALREADY_QUARANTINED", "Media sudah dikarantina.");
        previousState = subject.state;
        await transaction.mediaObject.update({ where: { id: subjectId }, data: { state: "QUARANTINED" } });
      }
      const record = await transaction.quarantineRecord.create({
        data: {
          institutionId,
          subjectType,
          subjectId,
          reasonCode: reason.reasonCode,
          safeDetail: reason.safeDetail,
          previousState,
          createdByOpsUserId: principal.id,
        },
      });
      await audit(transaction, principal, requestId, "SUBJECT_QUARANTINED", "QUARANTINE", record.id, {
        institution_id: institutionId,
        subject_type: subjectType,
        subject_id: subjectId,
        reason_code: reason.reasonCode,
      });
      return record;
    });
    return result(requestId, "QUARANTINED", quarantine.id);
  }

  async resolveQuarantine(quarantineIdValue: unknown, principal: OpsPrincipal, requestId: string) {
    const quarantineId = requiredUuid(quarantineIdValue, "Quarantine ID");
    const record = await this.databases.ops.quarantineRecord.findUnique({ where: { id: quarantineId } });
    if (!record || record.state !== "ACTIVE") throw new ApiError(404, "QUARANTINE_NOT_FOUND", "Karantina aktif tidak ditemukan.");
    await this.databases.ops.$transaction(async (transaction) => {
      if (record.subjectType === "PROFILE") {
        if (!(["ACTIVE", "HIDDEN"] as string[]).includes(record.previousState)) throw new ApiError(409, "RESTORE_STATE_INVALID", "Status profil sebelumnya tidak dapat dipulihkan.");
        const updated = await transaction.bprsProfile.updateMany({
          where: { id: record.subjectId, institutionId: record.institutionId, state: "QUARANTINED" },
          data: { state: record.previousState as "ACTIVE" | "HIDDEN" },
        });
        if (updated.count !== 1) throw new ApiError(409, "SUBJECT_STATE_CHANGED", "Status profil telah berubah; pemulihan dibatalkan.");
      } else if (record.subjectType === "PUBLICATION") {
        if (!(["PUBLISHED", "UNPUBLISHED", "ARCHIVED"] as string[]).includes(record.previousState)) throw new ApiError(409, "RESTORE_STATE_INVALID", "Status publikasi sebelumnya tidak dapat dipulihkan.");
        const updated = await transaction.publication.updateMany({
          where: { id: record.subjectId, institutionId: record.institutionId, state: "QUARANTINED" },
          data: { state: record.previousState as "PUBLISHED" | "UNPUBLISHED" | "ARCHIVED" },
        });
        if (updated.count !== 1) throw new ApiError(409, "SUBJECT_STATE_CHANGED", "Status publikasi telah berubah; pemulihan dibatalkan.");
      } else if (record.subjectType === "MEDIA") {
        if (!(["AWAITING_UPLOAD", "UPLOADED", "PROCESSING", "READY", "REJECTED", "REVOKED", "EXPIRED"] as string[]).includes(record.previousState)) throw new ApiError(409, "RESTORE_STATE_INVALID", "Status media sebelumnya tidak dapat dipulihkan.");
        const updated = await transaction.mediaObject.updateMany({
          where: { id: record.subjectId, institutionId: record.institutionId, state: "QUARANTINED" },
          data: { state: record.previousState as any },
        });
        if (updated.count !== 1) throw new ApiError(409, "SUBJECT_STATE_CHANGED", "Status media telah berubah; pemulihan dibatalkan.");
      } else {
        throw new ApiError(409, "SUBJECT_TYPE_INVALID", "Jenis subject karantina tidak dikenali.");
      }
      await transaction.quarantineRecord.update({
        where: { id: record.id },
        data: { state: "RESOLVED", resolvedAt: new Date() },
      });
      await audit(transaction, principal, requestId, "QUARANTINE_RESOLVED", "QUARANTINE", record.id, {
        subject_type: record.subjectType,
        subject_id: record.subjectId,
        restored_state: record.previousState,
      });
    });
    return result(requestId, "RESOLVED", quarantineId);
  }

  async health() {
    const checkedAt = new Date();
    await this.databases.ops.$queryRaw`SELECT 1`;
    const [deadLetter, overdue] = await Promise.all([
      this.databases.ops.centralJob.count({ where: { state: "DEAD_LETTER" } }),
      this.databases.ops.centralJob.count({ where: { state: { in: ["PENDING", "RETRY_WAIT"] }, availableAt: { lt: new Date(checkedAt.getTime() - 60_000) } } }),
    ]);
    const queueStatus = deadLetter > 0 || overdue > 0 ? "DEGRADED" : "OK";
    return {
      status: queueStatus === "OK" ? "OK" : "DEGRADED",
      checked_at: checkedAt.toISOString(),
      dependencies: { database: "OK", worker_queue: queueStatus },
    };
  }
}
