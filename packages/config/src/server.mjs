import path from "node:path";
import { z } from "zod";

const booleanText = z
  .enum(["true", "false"])
  .transform((value) => value === "true");

const optionalUrl = z.preprocess(
  (value) => (value === "" || value === undefined ? undefined : value),
  z.url().optional(),
);

const rawSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  SJ_API_HOST: z.string().min(1).default("127.0.0.1"),
  SJ_API_PORT: z.coerce.number().int().min(1).max(65535).default(4100),
  DATABASE_URL: optionalUrl,
  SJ_REGISTRY_DATABASE_URL: optionalUrl,
  SJ_INGEST_DATABASE_URL: optionalUrl,
  SJ_PUBLIC_DATABASE_URL: optionalUrl,
  SJ_OPS_DATABASE_URL: optionalUrl,
  SJ_WORKER_DATABASE_URL: optionalUrl,
  SJ_REDIS_URL: optionalUrl,
  SJ_PUBLIC_API_BASE_URL: z.url().default("http://127.0.0.1:4100"),
  SJ_PUBLIC_MEDIA_BASE_URL: z.url().default("http://127.0.0.1:4100/v1/public/media"),
  SJ_STORAGE_PROVIDER: z.enum(["FILESYSTEM", "S3_COMPATIBLE"]).default("FILESYSTEM"),
  SJ_STORAGE_ROOT: z.string().optional(),
  SJ_S3_ENDPOINT: optionalUrl,
  SJ_S3_REGION: z.string().optional(),
  SJ_S3_BUCKET: z.string().optional(),
  SJ_S3_ACCESS_KEY_ID: z.string().optional(),
  SJ_S3_SECRET_ACCESS_KEY: z.string().optional(),
  SJ_S3_FORCE_PATH_STYLE: booleanText.default(true),
  SJ_UPLOAD_SESSION_TTL_SECONDS: z.coerce.number().int().min(60).max(900).default(300),
  SJ_SIGNATURE_TOLERANCE_SECONDS: z.coerce.number().int().min(60).max(300).default(300),
  SJ_NONCE_TTL_SECONDS: z.coerce.number().int().min(600).max(3600).default(600),
  SJ_EVENT_BODY_MAX_BYTES: z.coerce.number().int().min(1024).max(262144).default(262144),
  SJ_MEDIA_FILE_MAX_BYTES: z.coerce.number().int().min(1).max(10485760).default(10485760),
  SJ_MEDIA_TOTAL_MAX_BYTES: z.coerce.number().int().min(1).max(52428800).default(52428800),
  SJ_STORAGE_STOP_FREE_BYTES: z.coerce.number().int().positive().optional(),
  SJ_RATE_LIMIT_INGEST_PER_MINUTE: z.coerce.number().int().positive().optional(),
  SJ_RATE_LIMIT_PUBLIC_PER_MINUTE: z.coerce.number().int().positive().optional(),
  SJ_RATE_LIMIT_OPS_AUTH_PER_MINUTE: z.coerce.number().int().positive().max(30).optional(),
  SJ_MALWARE_SCAN_MODE: z.enum(["CLAMAV", "TEST_SAFE"]).default("CLAMAV"),
  SJ_CLAMDSCAN_COMMAND: z.string().min(1).default("clamdscan"),
  SJ_OPS_ENCRYPTION_KEY_BASE64: z.string().optional(),
  SJ_OPS_SESSION_SECRET: z.string().min(32).optional(),
  SJ_PUBLIC_SITE_ENABLED: booleanText.default(false),
  SJ_INGEST_ENABLED: booleanText.default(false),
  SJ_MEDIA_UPLOAD_ENABLED: booleanText.default(false),
  SJ_WORKER_ENABLED: booleanText.default(false),
});

function requireValue(value, label, issues) {
  if (!value) issues.push(label + " wajib diisi.");
}

const privilegedDatabaseUsers = new Set([
  "postgres",
  "rdsadmin",
  "cloudsqlsuperuser",
  "azure_superuser",
]);

function parseDatabaseCredential(label, value, issues) {
  requireValue(value, label, issues);
  if (!value) return null;
  let url;
  try {
    url = new URL(value);
  } catch {
    issues.push(label + " wajib berupa URL PostgreSQL valid.");
    return null;
  }
  if (
    !["postgres:", "postgresql:"].includes(url.protocol)
    || !url.username
    || !url.password
    || !url.hostname
    || url.pathname.length <= 1
  ) {
    issues.push(label + " wajib memuat protocol, user, password, host, dan database.");
    return null;
  }
  const username = decodeURIComponent(url.username);
  if (privilegedDatabaseUsers.has(username.toLowerCase())) {
    issues.push(label + " tidak boleh memakai user database superuser.");
  }
  return {
    label,
    value,
    username,
    target: [
      url.hostname.toLowerCase(),
      url.port || "5432",
      url.pathname,
      url.searchParams.get("schema") || "public",
    ].join("|"),
  };
}

function requireDistinctDatabaseUrls(entries, issues) {
  const parsed = entries
    .map(([label, value]) => parseDatabaseCredential(label, value, issues))
    .filter(Boolean);
  if (parsed.length !== entries.length) return;
  if (new Set(parsed.map((entry) => entry.value)).size !== parsed.length) {
    issues.push("Credential database production untuk setiap scope proses harus berbeda.");
  }
  if (new Set(parsed.map((entry) => entry.username)).size !== parsed.length) {
    issues.push("User database production untuk setiap scope proses harus berbeda.");
  }
  if (new Set(parsed.map((entry) => entry.target)).size !== 1) {
    issues.push("Credential API pusat wajib menunjuk database Seputar Jaminan yang sama.");
  }
}

function validateRedisUrl(value, issues) {
  if (!value) return;
  let url;
  try {
    url = new URL(value);
  } catch {
    issues.push("SJ_REDIS_URL wajib berupa URL Redis valid.");
    return;
  }
  if (!['redis:', 'rediss:'].includes(url.protocol) || !url.hostname) {
    issues.push("SJ_REDIS_URL wajib memakai protocol redis atau rediss dan memuat host.");
  }
}

function validatePublicUrls(apiValue, mediaValue, issues) {
  let apiUrl;
  let mediaUrl;
  try {
    apiUrl = new URL(apiValue);
    mediaUrl = new URL(mediaValue);
  } catch {
    issues.push("URL publik API dan media wajib valid.");
    return;
  }
  for (const [label, url] of [
    ["SJ_PUBLIC_API_BASE_URL", apiUrl],
    ["SJ_PUBLIC_MEDIA_BASE_URL", mediaUrl],
  ]) {
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
      issues.push(label + " wajib HTTPS tanpa credential, query, atau fragment.");
    }
  }
  if ((apiUrl.pathname.replace(/\/+$/, "") || "/") !== "/") {
    issues.push("SJ_PUBLIC_API_BASE_URL wajib berupa origin tanpa path tambahan.");
  }
  if (mediaUrl.origin !== apiUrl.origin || mediaUrl.pathname.replace(/\/+$/, "") !== "/v1/public/media") {
    issues.push("SJ_PUBLIC_MEDIA_BASE_URL wajib memakai origin API yang sama dan path /v1/public/media.");
  }
}

function validateOpsEncryptionKey(value, issues) {
  if (!value) return;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value) || value.length % 4 !== 0) {
    issues.push("SJ_OPS_ENCRYPTION_KEY_BASE64 wajib base64 kanonis 32 byte.");
    return;
  }
  const decoded = Buffer.from(value, "base64");
  if (decoded.length !== 32 || decoded.toString("base64") !== value) {
    issues.push("SJ_OPS_ENCRYPTION_KEY_BASE64 wajib base64 kanonis 32 byte.");
  }
}

function storageConfig(raw) {
  return {
    provider: raw.SJ_STORAGE_PROVIDER,
    root: raw.SJ_STORAGE_ROOT,
    stopFreeBytes: raw.SJ_STORAGE_STOP_FREE_BYTES,
    s3: {
      endpoint: raw.SJ_S3_ENDPOINT,
      region: raw.SJ_S3_REGION,
      bucket: raw.SJ_S3_BUCKET,
      accessKeyId: raw.SJ_S3_ACCESS_KEY_ID,
      secretAccessKey: raw.SJ_S3_SECRET_ACCESS_KEY,
      forcePathStyle: raw.SJ_S3_FORCE_PATH_STYLE,
    },
  };
}

function validateStorage(config, repositoryRoot, issues) {
  if (config.storage.provider === "FILESYSTEM") {
    requireValue(config.storage.root, "SJ_STORAGE_ROOT", issues);
    if (config.storage.root) {
      const resolvedRoot = path.resolve(config.storage.root);
      if (!path.isAbsolute(config.storage.root)) {
        issues.push("SJ_STORAGE_ROOT harus berupa absolute path.");
      }
      if (
        config.nodeEnv === "production"
        && (resolvedRoot === repositoryRoot || resolvedRoot.startsWith(repositoryRoot + path.sep))
      ) {
        issues.push("SJ_STORAGE_ROOT production harus berada di luar source/release directory.");
      }
    }
  } else {
    requireValue(config.storage.s3.endpoint, "SJ_S3_ENDPOINT", issues);
    requireValue(config.storage.s3.region, "SJ_S3_REGION", issues);
    requireValue(config.storage.s3.bucket, "SJ_S3_BUCKET", issues);
    requireValue(config.storage.s3.accessKeyId, "SJ_S3_ACCESS_KEY_ID", issues);
    requireValue(config.storage.s3.secretAccessKey, "SJ_S3_SECRET_ACCESS_KEY", issues);
  }
}

function finishConfig(config, options, issues) {
  const repositoryRoot = path.resolve(options.repositoryRoot || process.cwd());
  validateStorage(config, repositoryRoot, issues);
  if (issues.length > 0) {
    const error = new Error("Konfigurasi Seputar Jaminan tidak aman atau belum lengkap.");
    error.issues = issues;
    throw error;
  }
  return Object.freeze(config);
}

export function loadApiServerConfig(environment = process.env, options = {}) {
  const raw = rawSchema.parse(environment);
  const fallbackDatabaseUrl = raw.NODE_ENV === "production" ? undefined : raw.DATABASE_URL;
  const config = {
    service: "api",
    nodeEnv: raw.NODE_ENV,
    api: { host: raw.SJ_API_HOST, port: raw.SJ_API_PORT },
    registryDatabaseUrl: raw.SJ_REGISTRY_DATABASE_URL || fallbackDatabaseUrl,
    ingestDatabaseUrl: raw.SJ_INGEST_DATABASE_URL || fallbackDatabaseUrl,
    publicDatabaseUrl: raw.SJ_PUBLIC_DATABASE_URL || fallbackDatabaseUrl,
    opsDatabaseUrl: raw.SJ_OPS_DATABASE_URL || fallbackDatabaseUrl,
    redisUrl: raw.SJ_REDIS_URL,
    publicApiBaseUrl: raw.SJ_PUBLIC_API_BASE_URL,
    publicMediaBaseUrl: raw.SJ_PUBLIC_MEDIA_BASE_URL,
    storage: storageConfig(raw),
    security: {
      signatureToleranceSeconds: raw.SJ_SIGNATURE_TOLERANCE_SECONDS,
      nonceTtlSeconds: raw.SJ_NONCE_TTL_SECONDS,
      eventBodyMaxBytes: raw.SJ_EVENT_BODY_MAX_BYTES,
      mediaFileMaxBytes: raw.SJ_MEDIA_FILE_MAX_BYTES,
      mediaTotalMaxBytes: raw.SJ_MEDIA_TOTAL_MAX_BYTES,
      opsEncryptionKeyBase64: raw.SJ_OPS_ENCRYPTION_KEY_BASE64,
      opsSessionSecret: raw.SJ_OPS_SESSION_SECRET,
    },
    rateLimit: {
      ingestPerMinute: raw.SJ_RATE_LIMIT_INGEST_PER_MINUTE,
      publicPerMinute: raw.SJ_RATE_LIMIT_PUBLIC_PER_MINUTE,
      opsAuthPerMinute: raw.SJ_RATE_LIMIT_OPS_AUTH_PER_MINUTE,
    },
    uploadSessionTtlSeconds: raw.SJ_UPLOAD_SESSION_TTL_SECONDS,
    flags: {
      publicSite: raw.SJ_PUBLIC_SITE_ENABLED,
      ingest: raw.SJ_INGEST_ENABLED,
      mediaUpload: raw.SJ_MEDIA_UPLOAD_ENABLED,
    },
  };
  const issues = [];
  if (config.nodeEnv === "production") {
    requireDistinctDatabaseUrls([
      ["SJ_REGISTRY_DATABASE_URL", config.registryDatabaseUrl],
      ["SJ_INGEST_DATABASE_URL", config.ingestDatabaseUrl],
      ["SJ_PUBLIC_DATABASE_URL", config.publicDatabaseUrl],
      ["SJ_OPS_DATABASE_URL", config.opsDatabaseUrl],
    ], issues);
    requireValue(config.redisUrl, "SJ_REDIS_URL", issues);
    requireValue(config.storage.stopFreeBytes, "SJ_STORAGE_STOP_FREE_BYTES", issues);
    requireValue(config.rateLimit.ingestPerMinute, "SJ_RATE_LIMIT_INGEST_PER_MINUTE", issues);
    requireValue(config.rateLimit.publicPerMinute, "SJ_RATE_LIMIT_PUBLIC_PER_MINUTE", issues);
    requireValue(config.rateLimit.opsAuthPerMinute, "SJ_RATE_LIMIT_OPS_AUTH_PER_MINUTE", issues);
    requireValue(config.security.opsEncryptionKeyBase64, "SJ_OPS_ENCRYPTION_KEY_BASE64", issues);
    requireValue(config.security.opsSessionSecret, "SJ_OPS_SESSION_SECRET", issues);
    validateRedisUrl(config.redisUrl, issues);
    validatePublicUrls(config.publicApiBaseUrl, config.publicMediaBaseUrl, issues);
    validateOpsEncryptionKey(config.security.opsEncryptionKeyBase64, issues);
  }
  return finishConfig(config, options, issues);
}

export function loadWorkerServerConfig(environment = process.env, options = {}) {
  const raw = rawSchema.parse(environment);
  const fallbackDatabaseUrl = raw.NODE_ENV === "production" ? undefined : raw.DATABASE_URL;
  const config = {
    service: "worker",
    nodeEnv: raw.NODE_ENV,
    workerDatabaseUrl: raw.SJ_WORKER_DATABASE_URL || fallbackDatabaseUrl,
    storage: storageConfig(raw),
    security: { mediaFileMaxBytes: raw.SJ_MEDIA_FILE_MAX_BYTES },
    malware: { mode: raw.SJ_MALWARE_SCAN_MODE, command: raw.SJ_CLAMDSCAN_COMMAND },
    flags: { worker: raw.SJ_WORKER_ENABLED },
  };
  const issues = [];
  if (config.nodeEnv === "production") {
    parseDatabaseCredential("SJ_WORKER_DATABASE_URL", config.workerDatabaseUrl, issues);
    requireValue(config.storage.stopFreeBytes, "SJ_STORAGE_STOP_FREE_BYTES", issues);
    if (config.malware.mode !== "CLAMAV") {
      issues.push("Production wajib memakai malware scanner CLAMAV yang fail-closed.");
    }
  }
  if (config.malware.mode === "TEST_SAFE" && config.nodeEnv !== "test") {
    issues.push("Mode TEST_SAFE hanya boleh digunakan oleh automated test.");
  }
  return finishConfig(config, options, issues);
}

// Kompatibilitas untuk pemanggil lama. Runtime baru wajib memilih loader sesuai proses.
export const loadServerConfig = loadApiServerConfig;

export function safeConfigSummary(config) {
  const summary = {
    service: config.service,
    nodeEnv: config.nodeEnv,
    storageProvider: config.storage.provider,
    storageRootConfigured: Boolean(config.storage.root),
    flags: config.flags,
  };
  if (config.service === "api") {
    const credentials = [
      config.registryDatabaseUrl,
      config.ingestDatabaseUrl,
      config.publicDatabaseUrl,
      config.opsDatabaseUrl,
    ];
    return {
      ...summary,
      api: config.api,
      redisConfigured: Boolean(config.redisUrl),
      databaseCredentialScope: "registry,ingest,public,ops",
      databaseCredentialsSeparated: credentials.every(Boolean)
        && new Set(credentials).size === credentials.length,
    };
  }
  return {
    ...summary,
    databaseCredentialScope: "worker-only",
    workerDatabaseConfigured: Boolean(config.workerDatabaseUrl),
    malwareMode: config.malware.mode,
  };
}
