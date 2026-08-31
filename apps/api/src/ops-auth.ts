import { createHmac, randomBytes } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { Algorithm, hash, verify } from "@node-rs/argon2";
import type { DatabaseClients } from "./database.js";
import { ApiError } from "./errors.js";
import { decryptSecret, verifyTotp } from "./ops-crypto.js";

const SESSION_TTL_MS = 30 * 60 * 1000;
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const LOCK_TTL_MS = 15 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;
const COOKIE_NAME = "sj_ops_session";

function opaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

function normalizeRecoveryCode(value: string): string {
  return value.replace(/[^a-z0-9]/giu, "").toUpperCase();
}

function readCookie(request: Request, name: string): string | undefined {
  const header = request.get("cookie");
  if (!header) return undefined;
  for (const item of header.split(";")) {
    const separator = item.indexOf("=");
    if (separator < 0) continue;
    const key = item.slice(0, separator).trim();
    if (key === name) return decodeURIComponent(item.slice(separator + 1).trim());
  }
  return undefined;
}

export function opsSessionCookie(token: string, production: boolean): string {
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/v1/ops; HttpOnly; SameSite=Strict; Max-Age=1800${production ? "; Secure" : ""}`;
}

export function clearOpsSessionCookie(production: boolean): string {
  return `${COOKIE_NAME}=; Path=/v1/ops; HttpOnly; SameSite=Strict; Max-Age=0${production ? "; Secure" : ""}`;
}

export async function hashOpsSecret(value: string): Promise<string> {
  return hash(value, {
    algorithm: Algorithm.Argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
    outputLen: 32,
  });
}

export type OpsPrincipal = { id: string; email: string; displayName: string; sessionId: string };

export class OpsAuthService {
  private readonly dummyHash: Promise<string>;

  constructor(
    private readonly databases: DatabaseClients,
    private readonly encryptionKeyBase64: string,
    private readonly sessionSecret: string,
  ) {
    if (!encryptionKeyBase64) throw new Error("SJ_OPS_ENCRYPTION_KEY_BASE64 wajib tersedia untuk operasi privat.");
    if (sessionSecret.length < 32) throw new Error("SJ_OPS_SESSION_SECRET minimal 32 karakter.");
    this.dummyHash = hashOpsSecret("seputarjaminan-dummy-password-not-for-login");
  }

  private tokenHash(value: string): string {
    return createHmac("sha256", this.sessionSecret).update(value).digest("hex");
  }

  async login(input: unknown, requestId: string) {
    const body = input as { email?: unknown; password?: unknown };
    if (typeof body?.email !== "string" || typeof body.password !== "string" || body.password.length < 12) {
      throw new ApiError(422, "LOGIN_INPUT_INVALID", "Email dan kata sandi wajib diisi.");
    }
    const email = body.email.trim().toLowerCase();
    const user = await this.databases.ops.opsUser.findUnique({ where: { emailNormalized: email } });
    const validPassword = await verify(user?.passwordHash || await this.dummyHash, body.password);
    const now = new Date();

    if (!user || !validPassword || user.state !== "ACTIVE" || (user.lockedUntil && user.lockedUntil > now)) {
      if (user && (!user.lockedUntil || user.lockedUntil <= now)) {
        const nextCount = user.failedAttemptCount + 1;
        await this.databases.ops.$transaction([
          this.databases.ops.opsUser.update({
            where: { id: user.id },
            data: {
              failedAttemptCount: nextCount >= MAX_FAILED_ATTEMPTS ? 0 : { increment: 1 },
              lockedUntil: nextCount >= MAX_FAILED_ATTEMPTS ? new Date(now.getTime() + LOCK_TTL_MS) : null,
            },
          }),
          this.databases.ops.opsAuditLog.create({
            data: {
              opsUserId: user.id,
              action: "OPS_LOGIN_REJECTED",
              subjectType: "OPS_USER",
              subjectId: user.id,
              requestId,
              safeMetadata: { reason: "INVALID_CREDENTIAL_OR_STATE" },
            },
          }),
        ]);
      }
      throw new ApiError(401, "LOGIN_REJECTED", "Email, kata sandi, atau status akun tidak valid.");
    }

    const verifiedFactor = await this.databases.ops.opsMfaFactor.findFirst({
      where: { opsUserId: user.id, revokedAt: null, verifiedAt: { not: null } },
      select: { id: true },
    });
    if (!verifiedFactor) throw new ApiError(403, "MFA_NOT_ENROLLED", "Akun operasi belum memiliki MFA aktif.");

    const challenge = opaqueToken();
    await this.databases.ops.$transaction([
      this.databases.ops.opsUser.update({
        where: { id: user.id },
        data: { failedAttemptCount: 0, lockedUntil: null },
      }),
      this.databases.ops.opsAuthChallenge.updateMany({
        where: { opsUserId: user.id, consumedAt: null },
        data: { consumedAt: now },
      }),
      this.databases.ops.opsAuthChallenge.create({
        data: {
          opsUserId: user.id,
          tokenHash: this.tokenHash(challenge),
          expiresAt: new Date(now.getTime() + CHALLENGE_TTL_MS),
        },
      }),
      this.databases.ops.opsAuditLog.create({
        data: {
          opsUserId: user.id,
          action: "OPS_PASSWORD_ACCEPTED",
          subjectType: "OPS_USER",
          subjectId: user.id,
          requestId,
        },
      }),
    ]);
    return {
      challenge_token: challenge,
      expires_at: new Date(now.getTime() + CHALLENGE_TTL_MS).toISOString(),
    };
  }

  async completeMfa(input: unknown, requestId: string) {
    const body = input as { challenge_token?: unknown; code?: unknown };
    if (
      typeof body?.challenge_token !== "string"
      || body.challenge_token.length < 32
      || typeof body.code !== "string"
      || body.code.length < 6
    ) {
      throw new ApiError(422, "MFA_INPUT_INVALID", "Kode MFA dan challenge wajib diisi.");
    }
    const now = new Date();
    const challenge = await this.databases.ops.opsAuthChallenge.findUnique({
      where: { tokenHash: this.tokenHash(body.challenge_token) },
      include: {
        user: {
          include: {
            mfaFactors: { where: { revokedAt: null, verifiedAt: { not: null } }, take: 1 },
            recoveryCodes: { where: { usedAt: null } },
          },
        },
      },
    });
    if (!challenge || challenge.consumedAt || challenge.expiresAt <= now || challenge.user.state !== "ACTIVE") {
      throw new ApiError(401, "MFA_CHALLENGE_INVALID", "Permintaan MFA tidak valid atau sudah kedaluwarsa.");
    }

    let recoveryCodeId: string | undefined;
    const factor = challenge.user.mfaFactors[0];
    let valid = false;
    if (factor) {
      const secret = decryptSecret(factor.encryptedSecret, this.encryptionKeyBase64);
      valid = verifyTotp(secret, body.code, now.getTime());
    }
    if (!valid) {
      const normalized = normalizeRecoveryCode(body.code);
      for (const recoveryCode of challenge.user.recoveryCodes) {
        if (await verify(recoveryCode.codeHash, normalized)) {
          recoveryCodeId = recoveryCode.id;
          valid = true;
          break;
        }
      }
    }
    if (!valid) throw new ApiError(401, "MFA_CODE_INVALID", "Kode MFA tidak valid.");

    const sessionToken = opaqueToken();
    const csrfToken = opaqueToken();
    const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
    const result = await this.databases.ops.$transaction(async (transaction) => {
      const consumed = await transaction.opsAuthChallenge.updateMany({
        where: { id: challenge.id, consumedAt: null, expiresAt: { gt: now } },
        data: { consumedAt: now },
      });
      if (consumed.count !== 1) throw new ApiError(409, "MFA_CHALLENGE_USED", "Permintaan MFA sudah digunakan.");
      if (recoveryCodeId) {
        const recovery = await transaction.opsRecoveryCode.updateMany({
          where: { id: recoveryCodeId, usedAt: null },
          data: { usedAt: now },
        });
        if (recovery.count !== 1) throw new ApiError(409, "RECOVERY_CODE_USED", "Kode pemulihan sudah digunakan.");
      }
      const session = await transaction.opsSession.create({
        data: {
          opsUserId: challenge.opsUserId,
          tokenHash: this.tokenHash(sessionToken),
          csrfTokenHash: this.tokenHash(csrfToken),
          expiresAt,
        },
      });
      await transaction.opsAuditLog.create({
        data: {
          opsUserId: challenge.opsUserId,
          action: recoveryCodeId ? "OPS_MFA_RECOVERY_ACCEPTED" : "OPS_MFA_ACCEPTED",
          subjectType: "OPS_SESSION",
          subjectId: session.id,
          requestId,
        },
      });
      return session;
    });
    return {
      session_token: sessionToken,
      csrf_token: csrfToken,
      expires_at: expiresAt.toISOString(),
      session_id: result.id,
    };
  }

  middleware(options: { csrf: boolean }) {
    return async (request: Request, response: Response, next: NextFunction) => {
      try {
        const sessionToken = readCookie(request, COOKIE_NAME);
        if (!sessionToken) throw new ApiError(401, "OPS_SESSION_REQUIRED", "Sesi operasi diperlukan.");
        const session = await this.databases.ops.opsSession.findUnique({
          where: { tokenHash: this.tokenHash(sessionToken) },
          include: { user: true },
        });
        const now = new Date();
        if (!session || session.revokedAt || session.expiresAt <= now || session.user.state !== "ACTIVE") {
          throw new ApiError(401, "OPS_SESSION_INVALID", "Sesi operasi tidak valid atau sudah berakhir.");
        }
        if (options.csrf) {
          const csrf = request.get("X-CSRF-Token");
          if (!csrf || this.tokenHash(csrf) !== session.csrfTokenHash) {
            throw new ApiError(403, "CSRF_INVALID", "Token keamanan permintaan tidak valid.");
          }
        }
        response.locals.opsUser = {
          id: session.user.id,
          email: session.user.emailNormalized,
          displayName: session.user.displayName,
          sessionId: session.id,
        } satisfies OpsPrincipal;
        next();
      } catch (error) {
        next(error);
      }
    };
  }

  async logout(principal: OpsPrincipal, requestId: string) {
    await this.databases.ops.$transaction([
      this.databases.ops.opsSession.updateMany({
        where: { id: principal.sessionId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.databases.ops.opsAuditLog.create({
        data: {
          opsUserId: principal.id,
          action: "OPS_LOGOUT",
          subjectType: "OPS_SESSION",
          subjectId: principal.sessionId,
          requestId,
        },
      }),
    ]);
  }
}
