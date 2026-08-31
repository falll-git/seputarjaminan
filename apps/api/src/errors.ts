import type { ErrorRequestHandler, RequestHandler } from "express";
import { randomUUID } from "node:crypto";

export class ApiError extends Error {
  status: number;
  code: string;
  retryable: boolean;
  fieldErrors?: Array<{ field: string; code: string; message: string }>;
  retryAfterSeconds?: number;

  constructor(status: number, code: string, message: string, options: {
    retryable?: boolean;
    fieldErrors?: Array<{ field: string; code: string; message: string }>;
    retryAfterSeconds?: number;
  } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.retryable = options.retryable ?? false;
    this.fieldErrors = options.fieldErrors;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}

export const requestContext: RequestHandler = (request, response, next) => {
  const incoming = request.get("X-Request-Id");
  const requestId = incoming && /^[a-f0-9-]{36}$/i.test(incoming) ? incoming : randomUUID();
  response.locals.requestId = requestId;
  response.setHeader("X-Request-Id", requestId);
  next();
};

export const notFoundHandler: RequestHandler = (_request, _response, next) => {
  next(new ApiError(404, "NOT_FOUND", "Data yang diminta tidak tersedia."));
};

export const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  const known = error instanceof ApiError;
  const status = known ? error.status : 500;
  const code = known ? error.code : "INTERNAL_ERROR";
  const retryable = known ? error.retryable : true;
  const message = known
    ? error.message
    : "Layanan sedang mengalami gangguan. Silakan coba kembali.";

  request.log?.error(
    {
      request_id: response.locals.requestId,
      code,
      status,
      error_name: error?.name,
      dependency_error_code:
        typeof error?.code === "string" && /^[A-Z0-9_]{2,40}$/u.test(error.code)
          ? error.code
          : undefined,
    },
    "request_failed",
  );

  if (known && error.retryAfterSeconds !== undefined) {
    response.setHeader("Retry-After", String(error.retryAfterSeconds));
  }
  response.status(status).json({
    request_id: response.locals.requestId,
    code,
    message,
    retryable,
    ...(known && error.retryAfterSeconds !== undefined
      ? { retry_after_seconds: error.retryAfterSeconds }
      : {}),
    ...(known && error.fieldErrors ? { field_errors: error.fieldErrors } : {}),
  });
};
