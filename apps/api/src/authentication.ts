import type { RequestHandler } from "express";
import { createHash, timingSafeEqual } from "node:crypto";
import {
  createContentSha256,
  createSigningMessage,
  INTEGRATION_HEADERS,
  verifyIntegrationMessage,
} from "@seputarjaminan/contracts";
import { Prisma } from "../../../generated/prisma/client.ts";
import type { DatabaseClients } from "./database.js";
import { withInstitution } from "./database.js";
import { ApiError } from "./errors.js";

function requiredHeader(request: Parameters<RequestHandler>[0], name: string) {
  const value = request.get(name);
  if (!value) {
    throw new ApiError(401, "SIGNATURE_REQUIRED", "Koneksi Ruwang tidak dapat diverifikasi.");
  }
  if (/[\r\n]/.test(value)) {
    throw new ApiError(401, "SIGNATURE_INVALID", "Koneksi Ruwang tidak dapat diverifikasi.");
  }
  return value;
}

function equalDigest(actual: string, expected: string) {
  if (!/^[a-f0-9]{64}$/.test(expected)) return false;
  return timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
}

export function createIntegrationAuthentication({
  databases,
  toleranceSeconds,
  nonceTtlSeconds,
  now = () => new Date(),
}: {
  databases: DatabaseClients;
  toleranceSeconds: number;
  nonceTtlSeconds: number;
  now?: () => Date;
}): RequestHandler {
  return async (request, _response, next) => {
    try {
      const institutionId = requiredHeader(request, INTEGRATION_HEADERS.institutionId);
      const keyId = requiredHeader(request, INTEGRATION_HEADERS.keyId);
      const timestamp = requiredHeader(request, INTEGRATION_HEADERS.timestamp);
      const nonce = requiredHeader(request, INTEGRATION_HEADERS.nonce);
      const expectedDigest = requiredHeader(request, INTEGRATION_HEADERS.contentSha256).toLowerCase();
      const signature = requiredHeader(request, INTEGRATION_HEADERS.signature);

      if (!/^[0-9a-f-]{36}$/i.test(institutionId) || !/^[0-9a-f-]{36}$/i.test(keyId)) {
        throw new ApiError(401, "SIGNATURE_INVALID", "Koneksi Ruwang tidak dapat diverifikasi.");
      }
      if (nonce.length < 16 || nonce.length > 200) {
        throw new ApiError(401, "SIGNATURE_INVALID", "Koneksi Ruwang tidak dapat diverifikasi.");
      }
      const requestTime = new Date(timestamp);
      if (!timestamp.endsWith("Z") || Number.isNaN(requestTime.getTime())) {
        throw new ApiError(401, "SIGNATURE_INVALID", "Koneksi Ruwang tidak dapat diverifikasi.");
      }
      const delta = Math.abs(now().getTime() - requestTime.getTime());
      if (delta > toleranceSeconds * 1000) {
        throw new ApiError(401, "SIGNATURE_EXPIRED", "Waktu koneksi Ruwang perlu diperiksa.");
      }
      const parsedUrl = new URL(request.originalUrl, "http://local.invalid");
      if (parsedUrl.search) {
        throw new ApiError(400, "SIGNED_QUERY_FORBIDDEN", "Endpoint integrasi ini tidak menerima query.");
      }
      const rawBody = request.rawBody || Buffer.alloc(0);
      const actualDigest = createContentSha256(rawBody);
      if (!equalDigest(actualDigest, expectedDigest)) {
        throw new ApiError(401, "SIGNATURE_INVALID", "Koneksi Ruwang tidak dapat diverifikasi.");
      }

      const key = await withInstitution(databases.registry, institutionId, (transaction) =>
        transaction.institutionKey.findUnique({
          where: { keyId },
          include: {
            installation: { include: { institution: true } },
          },
        }),
      );
      const current = now();
      if (
        !key
        || key.institutionId !== institutionId
        || !["ACTIVE", "ROTATING"].includes(key.state)
        || key.algorithm !== "ED25519"
        || key.validFrom > current
        || (key.validUntil && key.validUntil <= current)
        || key.installation.state !== "ACTIVE"
        || key.installation.institution.state !== "ACTIVE"
      ) {
        throw new ApiError(401, "SIGNATURE_INVALID", "Koneksi Ruwang tidak dapat diverifikasi.");
      }

      const signingMessage = createSigningMessage({
        method: request.method,
        path: parsedUrl.pathname,
        timestamp,
        nonce,
        contentSha256: expectedDigest,
      });
      if (!verifyIntegrationMessage(signingMessage, signature, key.publicKey)) {
        throw new ApiError(401, "SIGNATURE_INVALID", "Koneksi Ruwang tidak dapat diverifikasi.");
      }

      const nonceHash = createHash("sha256").update(nonce, "utf8").digest("hex");
      try {
        await withInstitution(databases.ingest, institutionId, (transaction) =>
          transaction.requestNonce.create({
            data: {
              keyId,
              nonceHash,
              expiresAt: new Date(current.getTime() + nonceTtlSeconds * 1000),
            },
          }),
        );
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          throw new ApiError(409, "REPLAY_REJECTED", "Request yang sama sudah pernah diterima.");
        }
        throw error;
      }

      request.integrationAuth = {
        institutionId,
        installationId: key.installationId,
        keyId,
        nonceHash,
        requestTimestamp: requestTime,
      };
      next();
    } catch (error) {
      next(error);
    }
  };
}
