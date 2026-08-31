import express, { type RequestHandler } from "express";
import helmet from "helmet";
import pino from "pino";
import pinoHttp from "pino-http";
import { assertValidIntegrationEvent } from "@seputarjaminan/contracts";
import { createIntegrationAuthentication } from "./authentication.js";
import type { DatabaseClients } from "./database.js";
import { ApiError, errorHandler, notFoundHandler, requestContext } from "./errors.js";
import { IngestService } from "./ingest-service.js";
import { MediaService } from "./media-service.js";
import {
  clearOpsSessionCookie,
  OpsAuthService,
  opsSessionCookie,
  type OpsPrincipal,
} from "./ops-auth.js";
import { OpsService } from "./ops-service.js";
import { PublicService } from "./public-service.js";
import type { RateLimiter } from "./rate-limit.js";
import { rateLimitMiddleware } from "./rate-limit.js";
import { ReconciliationService } from "./reconciliation-service.js";

type RuntimeConfig = any;

function requireFeature(enabled: boolean, code: string): RequestHandler {
  return (_request, _response, next) => {
    if (!enabled) {
      return next(new ApiError(503, code, "Fitur ini belum diaktifkan.", { retryable: false }));
    }
    next();
  };
}

export function createApp({
  config,
  databases,
  storage,
  ingestLimiter,
  publicLimiter,
  logger = pino({ level: "silent" }),
}: {
  config: RuntimeConfig;
  databases: DatabaseClients;
  storage: any;
  ingestLimiter: RateLimiter;
  publicLimiter: RateLimiter;
  logger?: pino.Logger;
}) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(requestContext);
  app.use(pinoHttp({
    logger,
    redact: [
      "req.headers.x-sj-signature",
      "req.headers.x-sj-nonce",
      "req.headers.x-sj-upload-token",
      "req.headers.cookie",
      "res.headers.set-cookie",
    ],
  }));

  const jsonParser = express.json({
    type: "application/json",
    limit: config.security.eventBodyMaxBytes,
    strict: true,
    verify(request, _response, buffer) {
      (request as express.Request).rawBody = Buffer.from(buffer);
    },
  });
  app.use(jsonParser);

  const authenticate = createIntegrationAuthentication({
    databases,
    toleranceSeconds: config.security.signatureToleranceSeconds,
    nonceTtlSeconds: config.security.nonceTtlSeconds,
  });
  const signedLimit = rateLimitMiddleware({
    limiter: ingestLimiter,
    limit: config.rateLimit.ingestPerMinute || 60,
    key: (request) => "ingest:" + (request.integrationAuth?.institutionId || "unknown"),
  });
  const visitorLimit = rateLimitMiddleware({
    limiter: publicLimiter,
    limit: config.rateLimit.publicPerMinute || 600,
    key: (request) => "public:" + request.ip,
  });

  const ingestService = new IngestService(databases);
  const mediaService = new MediaService(databases, storage, config);
  const reconciliationService = new ReconciliationService(databases);
  const publicService = new PublicService(databases, storage, config.publicMediaBaseUrl);
  const opsAuthService = config.security.opsEncryptionKeyBase64 && config.security.opsSessionSecret
    ? new OpsAuthService(
        databases,
        config.security.opsEncryptionKeyBase64,
        config.security.opsSessionSecret,
      )
    : null;
  const opsService = new OpsService(databases);
  const opsAuthLimit = rateLimitMiddleware({
    limiter: publicLimiter,
    limit: config.rateLimit.opsAuthPerMinute || 10,
    key: (request) => "ops-auth:" + request.ip,
  });
  const requireOpsConfigured: RequestHandler = (_request, _response, next) => {
    if (!opsAuthService) return next(new ApiError(503, "OPS_NOT_CONFIGURED", "Layanan operasi privat belum dikonfigurasi."));
    next();
  };
  const requireOpsSession: RequestHandler = (request, response, next) => {
    if (!opsAuthService) return next(new ApiError(503, "OPS_NOT_CONFIGURED", "Layanan operasi privat belum dikonfigurasi."));
    return opsAuthService.middleware({ csrf: false })(request, response, next);
  };
  const requireOpsMutation: RequestHandler = (request, response, next) => {
    if (!opsAuthService) return next(new ApiError(503, "OPS_NOT_CONFIGURED", "Layanan operasi privat belum dikonfigurasi."));
    return opsAuthService.middleware({ csrf: true })(request, response, next);
  };
  const principal = (response: express.Response) => response.locals.opsUser as OpsPrincipal;

  app.get("/health/live", (_request, response) => {
    response.json({ status: "OK", checked_at: new Date().toISOString() });
  });
  app.get("/health/ready", async (_request, response, next) => {
    try {
      await databases.registry.$queryRaw`SELECT 1`;
      response.json({ status: "OK", checked_at: new Date().toISOString() });
    } catch {
      next(new ApiError(503, "DATABASE_UNAVAILABLE", "Database pusat belum siap.", { retryable: true }));
    }
  });

  app.post("/v1/ops/auth/login", requireOpsConfigured, opsAuthLimit, async (request, response, next) => {
    try {
      const value = await opsAuthService!.login(request.body, response.locals.requestId);
      response.json({ request_id: response.locals.requestId, ...value });
    } catch (error) { next(error); }
  });
  app.post("/v1/ops/auth/mfa", requireOpsConfigured, opsAuthLimit, async (request, response, next) => {
    try {
      const value = await opsAuthService!.completeMfa(request.body, response.locals.requestId);
      response.setHeader("Set-Cookie", opsSessionCookie(value.session_token, config.nodeEnv === "production"));
      response.json({ request_id: response.locals.requestId, csrf_token: value.csrf_token, expires_at: value.expires_at });
    } catch (error) { next(error); }
  });
  app.post("/v1/ops/auth/logout", requireOpsMutation, async (_request, response, next) => {
    try {
      await opsAuthService!.logout(principal(response), response.locals.requestId);
      response.setHeader("Set-Cookie", clearOpsSessionCookie(config.nodeEnv === "production"));
      response.status(204).end();
    } catch (error) { next(error); }
  });
  app.post("/v1/ops/institutions", requireOpsMutation, async (request, response, next) => {
    try { response.status(201).json(await opsService.onboard(request.body, principal(response), response.locals.requestId)); }
    catch (error) { next(error); }
  });
  app.post("/v1/ops/institutions/:institutionId/suspend", requireOpsMutation, async (request, response, next) => {
    try { response.json(await opsService.setInstitutionState(request.params.institutionId, "SUSPENDED", request.body, principal(response), response.locals.requestId)); }
    catch (error) { next(error); }
  });
  app.post("/v1/ops/institutions/:institutionId/reactivate", requireOpsMutation, async (request, response, next) => {
    try { response.json(await opsService.setInstitutionState(request.params.institutionId, "ACTIVE", request.body, principal(response), response.locals.requestId)); }
    catch (error) { next(error); }
  });
  app.post("/v1/ops/installations/:installationId/keys/rotate", requireOpsMutation, async (request, response, next) => {
    try { response.json(await opsService.rotateKey(request.params.installationId, request.body, principal(response), response.locals.requestId)); }
    catch (error) { next(error); }
  });
  app.post("/v1/ops/installations/:installationId/suspend", requireOpsMutation, async (request, response, next) => {
    try { response.json(await opsService.setInstallationState(request.params.installationId, "SUSPENDED", request.body, principal(response), response.locals.requestId)); }
    catch (error) { next(error); }
  });
  app.post("/v1/ops/installations/:installationId/reactivate", requireOpsMutation, async (request, response, next) => {
    try { response.json(await opsService.setInstallationState(request.params.installationId, "ACTIVE", request.body, principal(response), response.locals.requestId)); }
    catch (error) { next(error); }
  });
  app.post("/v1/ops/installations/:installationId/keys/:keyId/revoke", requireOpsMutation, async (request, response, next) => {
    try { response.json(await opsService.revokeKey(request.params.installationId, request.params.keyId, request.body, principal(response), response.locals.requestId)); }
    catch (error) { next(error); }
  });
  app.post("/v1/ops/quarantines", requireOpsMutation, async (request, response, next) => {
    try { response.status(201).json(await opsService.quarantine(request.body, principal(response), response.locals.requestId)); }
    catch (error) { next(error); }
  });
  app.post("/v1/ops/quarantines/:quarantineId/resolve", requireOpsMutation, async (request, response, next) => {
    try { response.json(await opsService.resolveQuarantine(request.params.quarantineId, principal(response), response.locals.requestId)); }
    catch (error) { next(error); }
  });
  app.get("/v1/ops/health", requireOpsSession, async (_request, response, next) => {
    try { response.json(await opsService.health()); } catch (error) { next(error); }
  });

  app.post(
    "/v1/ingest/events",
    requireFeature(config.flags.ingest, "INGEST_DISABLED"),
    authenticate,
    signedLimit,
    async (request, response, next) => {
      try {
        assertValidIntegrationEvent(request.body);
        const result = await ingestService.ingest(request.body, request.integrationAuth!);
        response.json({
          request_id: response.locals.requestId,
          status: result.status,
          event_id: request.body.event_id,
          active_aggregate_version: result.activeAggregateVersion,
          acknowledged_at: new Date().toISOString(),
        });
      } catch (error: any) {
        if (error?.contractErrors) {
          return next(new ApiError(422, "EVENT_CONTRACT_INVALID", "Data publikasi belum sesuai aturan.", {
            fieldErrors: error.contractErrors.map((item: any) => ({
              field: item.path,
              code: String(item.keyword).toUpperCase(),
              message: item.message,
            })),
          }));
        }
        next(error);
      }
    },
  );

  app.post(
    "/v1/media/upload-sessions",
    requireFeature(config.flags.mediaUpload, "MEDIA_UPLOAD_DISABLED"),
    authenticate,
    signedLimit,
    async (request, response, next) => {
      try {
        const result = await mediaService.createUploadSession(
          request.body,
          request.integrationAuth!,
          response.locals.requestId,
        );
        response.status(201).json(result);
      } catch (error) {
        next(error);
      }
    },
  );

  app.put(
    "/v1/media/upload-sessions/:sessionId/content",
    requireFeature(config.flags.mediaUpload, "MEDIA_UPLOAD_DISABLED"),
    express.raw({
      type: ["image/jpeg", "image/png", "image/webp"],
      limit: config.security.mediaFileMaxBytes,
    }),
    async (request, response, next) => {
      try {
        await mediaService.uploadFilesystemContent(request);
        response.status(204).end();
      } catch (error) {
        next(error);
      }
    },
  );

  app.post(
    "/v1/media/upload-sessions/:sessionId/complete",
    requireFeature(config.flags.mediaUpload, "MEDIA_UPLOAD_DISABLED"),
    authenticate,
    signedLimit,
    async (request, response, next) => {
      try {
        if (!request.body?.media_id) {
          throw new ApiError(422, "MEDIA_ID_REQUIRED", "Identitas gambar belum tersedia.");
        }
        const result = await mediaService.complete(
          String(request.params.sessionId),
          String(request.body.media_id),
          request.integrationAuth!.institutionId,
          response.locals.requestId,
        );
        response.status(202).json(result);
      } catch (error) {
        next(error);
      }
    },
  );

  app.get(
    "/v1/media/:mediaId/status",
    authenticate,
    signedLimit,
    async (request, response, next) => {
      try {
        response.json(await mediaService.status(
          String(request.params.mediaId),
          request.integrationAuth!.institutionId,
          response.locals.requestId,
        ));
      } catch (error) {
        next(error);
      }
    },
  );

  app.post(
    "/v1/reconciliation/manifests",
    authenticate,
    signedLimit,
    async (request, response, next) => {
      try {
        response.status(202).json(await reconciliationService.create(
          request.body,
          request.integrationAuth!,
          response.locals.requestId,
        ));
      } catch (error) {
        next(error);
      }
    },
  );

  app.get(
    "/v1/reconciliation/runs/:runId",
    authenticate,
    signedLimit,
    async (request, response, next) => {
      try {
        response.json(await reconciliationService.get(
          String(request.params.runId),
          request.integrationAuth!.institutionId,
          response.locals.requestId,
        ));
      } catch (error) {
        next(error);
      }
    },
  );

  app.get("/v1/public/assets", requireFeature(config.flags.publicSite, "PUBLIC_SITE_DISABLED"), visitorLimit,
    async (request, response, next) => {
      try { response.json(await publicService.listAssets(request.query)); } catch (error) { next(error); }
    });
  app.get("/v1/public/assets/:referenceCode", requireFeature(config.flags.publicSite, "PUBLIC_SITE_DISABLED"), visitorLimit,
    async (request, response, next) => {
      try { response.json(await publicService.getAsset(String(request.params.referenceCode))); } catch (error) { next(error); }
    });
  app.get("/v1/public/institutions", requireFeature(config.flags.publicSite, "PUBLIC_SITE_DISABLED"), visitorLimit,
    async (request, response, next) => {
      try { response.json(await publicService.listInstitutions(request.query)); } catch (error) { next(error); }
    });
  app.get("/v1/public/institutions/:publicSlug", requireFeature(config.flags.publicSite, "PUBLIC_SITE_DISABLED"), visitorLimit,
    async (request, response, next) => {
      try { response.json(await publicService.getInstitution(String(request.params.publicSlug))); } catch (error) { next(error); }
    });
  app.get("/v1/public/taxonomy", requireFeature(config.flags.publicSite, "PUBLIC_SITE_DISABLED"), visitorLimit,
    (_request, response) => response.json(publicService.taxonomy()));
  app.get("/v1/public/media/:mediaId", requireFeature(config.flags.publicSite, "PUBLIC_SITE_DISABLED"), visitorLimit,
    async (request, response, next) => {
      try {
        const object = await publicService.readMedia(String(request.params.mediaId));
        response.setHeader("Content-Type", object.contentType);
        response.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=60");
        object.body.on("error", next).pipe(response);
      } catch (error) {
        next(error);
      }
    });

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
