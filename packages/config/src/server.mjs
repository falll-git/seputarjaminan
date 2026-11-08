import path from "node:path";
import { createPrivateKey, createPublicKey } from "node:crypto";
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
  SJ_PUBLIC_WEBSITE_ORIGIN: optionalUrl,
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
  SJ_CLAMAV_DOCKER_CONTAINER: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/).optional(),
  SJ_OPS_ENCRYPTION_KEY_BASE64: z.string().optional(),
  SJ_OPS_SESSION_SECRET: z.string().min(32).optional(),
  SJ_PUBLIC_SITE_ENABLED: booleanText.default(false),
  SJ_INGEST_ENABLED: booleanText.default(false),
  SJ_MEDIA_UPLOAD_ENABLED: booleanText.default(false),
  SJ_WORKER_ENABLED: booleanText.default(false),
  SJ_CONTROL_MONITORING_ENABLED: booleanText.default(false),
  SJ_CONTROL_RECOVERY_ENABLED: booleanText.default(false),
  SJ_CONTROL_RECOVERY_BINDINGS: z.string().max(262144).optional(),
  SJ_CONTROL_RECOVERY_AUDIENCE: z.string().min(1).max(150).regex(/^[^\r\n]+$/).optional(),
  SJ_CONTROL_RECOVERY_RESPONSE_KEY_ID: z.string().regex(/^[A-Za-z0-9._-]{2,100}$/).optional(),
  SJ_CONTROL_RECOVERY_RESPONSE_PRIVATE_KEY: z.string().optional(),
  SJ_CONTROL_MONITORING_INSTANCE_ID: z.string().optional(),
  SJ_CONTROL_MONITORING_KEY_ID: z.string().optional(),
  SJ_CONTROL_MONITORING_PUBLIC_KEY: z.string().optional(),
  SJ_CONTROL_MONITORING_RESPONSE_KEY_ID: z.string().optional(),
  SJ_CONTROL_MONITORING_RESPONSE_PRIVATE_KEY: z.string().optional(),
  SJ_CONTROL_MONITORING_AUDIENCE: z.string().optional(),
  SJ_CONTROL_MONITORING_FRONTEND_URL: optionalUrl,
  SJ_CONTROL_MONITORING_PROBE_TIMEOUT_MS: z.coerce.number().int().min(250).max(30000).default(2500),
  SJ_WORKER_HEARTBEAT_KEY: z.string().regex(/^[a-z0-9][a-z0-9:_-]{2,120}$/).default("seputarjaminan:worker-heartbeat:central"),
  SJ_WORKER_HEARTBEAT_INTERVAL_MS: z.coerce.number().int().min(1000).max(60000).default(5000),
  SJ_WORKER_HEARTBEAT_TTL_MS: z.coerce.number().int().min(3000).max(180000).default(15000),
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

function validateEd25519Key(value, label, kind, issues) {
  if (!value) return;
  try {
    const key = kind === "public" ? createPublicKey(value) : createPrivateKey(value);
    if (key.asymmetricKeyType !== "ed25519") issues.push(label + " wajib berupa key Ed25519.");
  } catch {
    issues.push(label + " wajib berupa key Ed25519 valid.");
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
    publicWebsiteOrigin: raw.SJ_PUBLIC_WEBSITE_ORIGIN,
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
      controlMonitoring: raw.SJ_CONTROL_MONITORING_ENABLED,
      controlRecovery: raw.SJ_CONTROL_RECOVERY_ENABLED,
    },
    controlRecovery: {
      bindings: [], audience: raw.SJ_CONTROL_RECOVERY_AUDIENCE,
      responseKeyId: raw.SJ_CONTROL_RECOVERY_RESPONSE_KEY_ID,
      responsePrivateKey: raw.SJ_CONTROL_RECOVERY_RESPONSE_PRIVATE_KEY,
    },
    controlMonitoring: {
      instanceId: raw.SJ_CONTROL_MONITORING_INSTANCE_ID,
      keyId: raw.SJ_CONTROL_MONITORING_KEY_ID,
      publicKey: raw.SJ_CONTROL_MONITORING_PUBLIC_KEY,
      responseKeyId: raw.SJ_CONTROL_MONITORING_RESPONSE_KEY_ID,
      responsePrivateKey: raw.SJ_CONTROL_MONITORING_RESPONSE_PRIVATE_KEY,
      audience: raw.SJ_CONTROL_MONITORING_AUDIENCE,
      frontendUrl: raw.SJ_CONTROL_MONITORING_FRONTEND_URL,
      probeTimeoutMs: raw.SJ_CONTROL_MONITORING_PROBE_TIMEOUT_MS,
      workerHeartbeatKey: raw.SJ_WORKER_HEARTBEAT_KEY,
    },
  };
  const issues = [];
  if (config.flags.controlRecovery) {
    for (const [label,value] of [['SJ_REDIS_URL',config.redisUrl],['SJ_CONTROL_RECOVERY_AUDIENCE',config.controlRecovery.audience],
      ['SJ_CONTROL_RECOVERY_RESPONSE_KEY_ID',config.controlRecovery.responseKeyId],['SJ_CONTROL_RECOVERY_RESPONSE_PRIVATE_KEY',config.controlRecovery.responsePrivateKey]]) requireValue(value,label,issues);
    validateEd25519Key(config.controlRecovery.responsePrivateKey,'SJ_CONTROL_RECOVERY_RESPONSE_PRIVATE_KEY','private',issues);
    const binding=z.object({instanceId:z.uuid(),institutionId:z.uuid(),installationId:z.uuid(),
      keyId:z.string().regex(/^[A-Za-z0-9._-]{2,100}$/),publicKey:z.string().min(1)}).strict();
    try {
      config.controlRecovery.bindings=z.array(binding).min(1).max(500).parse(JSON.parse(raw.SJ_CONTROL_RECOVERY_BINDINGS||'null'));
      const ids=new Set();
      for(const item of config.controlRecovery.bindings){
        if(ids.has(item.instanceId))issues.push('SJ_CONTROL_RECOVERY_BINDINGS memiliki instance ganda.');
        ids.add(item.instanceId);validateEd25519Key(item.publicKey,'SJ_CONTROL_RECOVERY_BINDINGS','public',issues);
      }
    }catch{issues.push('SJ_CONTROL_RECOVERY_BINDINGS wajib daftar binding eksplisit yang valid.');}
  }
  if (config.publicWebsiteOrigin) {
    const website = new URL(config.publicWebsiteOrigin);
    if (website.username || website.password || website.search || website.hash || !['', '/'].includes(website.pathname)
      || (website.protocol !== 'https:' && !(raw.NODE_ENV !== 'production' && website.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(website.hostname)))) {
      issues.push('SJ_PUBLIC_WEBSITE_ORIGIN wajib berupa origin website tepercaya, HTTPS kecuali loopback lokal non-production.');
    } else config.publicWebsiteOrigin = website.origin;
  }
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
  if (config.flags.controlMonitoring) {
    for (const [label, value] of [
      ["SJ_CONTROL_MONITORING_INSTANCE_ID", config.controlMonitoring.instanceId],
      ["SJ_CONTROL_MONITORING_KEY_ID", config.controlMonitoring.keyId],
      ["SJ_CONTROL_MONITORING_PUBLIC_KEY", config.controlMonitoring.publicKey],
      ["SJ_CONTROL_MONITORING_RESPONSE_KEY_ID", config.controlMonitoring.responseKeyId],
      ["SJ_CONTROL_MONITORING_RESPONSE_PRIVATE_KEY", config.controlMonitoring.responsePrivateKey],
      ["SJ_CONTROL_MONITORING_AUDIENCE", config.controlMonitoring.audience],
      ["SJ_CONTROL_MONITORING_FRONTEND_URL", config.controlMonitoring.frontendUrl],
      ["SJ_REDIS_URL", config.redisUrl],
    ]) requireValue(value, label, issues);
    if (config.controlMonitoring.instanceId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(config.controlMonitoring.instanceId)) {
      issues.push("SJ_CONTROL_MONITORING_INSTANCE_ID wajib UUID valid.");
    }
    for (const [label, value] of [["SJ_CONTROL_MONITORING_KEY_ID", config.controlMonitoring.keyId], ["SJ_CONTROL_MONITORING_RESPONSE_KEY_ID", config.controlMonitoring.responseKeyId]]) {
      if (value && !/^[A-Za-z0-9._-]{2,100}$/.test(value)) issues.push(label + " tidak valid.");
    }
    if (config.controlMonitoring.audience && (config.controlMonitoring.audience.length > 150 || /[\r\n]/.test(config.controlMonitoring.audience))) {
      issues.push("SJ_CONTROL_MONITORING_AUDIENCE tidak valid.");
    }
    validateEd25519Key(config.controlMonitoring.publicKey, "SJ_CONTROL_MONITORING_PUBLIC_KEY", "public", issues);
    validateEd25519Key(config.controlMonitoring.responsePrivateKey, "SJ_CONTROL_MONITORING_RESPONSE_PRIVATE_KEY", "private", issues);
    if (config.controlMonitoring.frontendUrl) {
      const frontendUrl = new URL(config.controlMonitoring.frontendUrl);
      if (frontendUrl.username || frontendUrl.password || frontendUrl.search || frontendUrl.hash ||
          (frontendUrl.pathname.replace(/\/+$/, "") || "/") !== "/") {
        issues.push("SJ_CONTROL_MONITORING_FRONTEND_URL wajib berupa origin tanpa credential, path, query, atau fragment.");
      }
      if (config.nodeEnv === "production" && frontendUrl.protocol !== "https:") {
        issues.push("SJ_CONTROL_MONITORING_FRONTEND_URL wajib HTTPS di production.");
      }
    }
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
    redisUrl: raw.SJ_REDIS_URL,
    storage: storageConfig(raw),
    security: { mediaFileMaxBytes: raw.SJ_MEDIA_FILE_MAX_BYTES },
    malware: { mode: raw.SJ_MALWARE_SCAN_MODE, command: raw.SJ_CLAMDSCAN_COMMAND, ...(raw.SJ_CLAMAV_DOCKER_CONTAINER ? { dockerContainer: raw.SJ_CLAMAV_DOCKER_CONTAINER } : {}) },
    flags: { worker: raw.SJ_WORKER_ENABLED },
    heartbeat: { key: raw.SJ_WORKER_HEARTBEAT_KEY, intervalMs: raw.SJ_WORKER_HEARTBEAT_INTERVAL_MS, ttlMs: raw.SJ_WORKER_HEARTBEAT_TTL_MS },
  };
  const issues = [];
  if (config.nodeEnv === "production") {
    parseDatabaseCredential("SJ_WORKER_DATABASE_URL", config.workerDatabaseUrl, issues);
    requireValue(config.storage.stopFreeBytes, "SJ_STORAGE_STOP_FREE_BYTES", issues);
    if (config.malware.mode !== "CLAMAV") {
      issues.push("Production wajib memakai malware scanner CLAMAV yang fail-closed.");
    }
    requireValue(config.redisUrl, "SJ_REDIS_URL", issues);
    validateRedisUrl(config.redisUrl, issues);
  }
  if (config.heartbeat.ttlMs <= config.heartbeat.intervalMs * 2) issues.push("SJ_WORKER_HEARTBEAT_TTL_MS harus lebih besar dari dua kali interval heartbeat.");
  if (config.malware.mode === "TEST_SAFE" && config.nodeEnv !== "test") {
    issues.push("Mode TEST_SAFE hanya boleh digunakan oleh automated test.");
  }
  if (config.malware.dockerContainer && (config.nodeEnv === "production" || config.malware.mode !== "CLAMAV")) {
    issues.push("Docker scanner hanya untuk CLAMAV lokal; production memakai clamdscan native.");
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
