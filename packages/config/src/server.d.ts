export type StorageConfig = {
  provider: "FILESYSTEM" | "S3_COMPATIBLE";
  root?: string;
  stopFreeBytes?: number;
  s3: {
    endpoint?: string;
    region?: string;
    bucket?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    forcePathStyle: boolean;
  };
};

export type ApiServerConfig = {
  service: "api";
  nodeEnv: "development" | "test" | "production";
  api: { host: string; port: number };
  registryDatabaseUrl: string;
  ingestDatabaseUrl: string;
  publicDatabaseUrl: string;
  opsDatabaseUrl: string;
  redisUrl?: string;
  publicApiBaseUrl: string;
  publicMediaBaseUrl: string;
  storage: StorageConfig;
  security: {
    signatureToleranceSeconds: number;
    nonceTtlSeconds: number;
    eventBodyMaxBytes: number;
    mediaFileMaxBytes: number;
    mediaTotalMaxBytes: number;
    opsEncryptionKeyBase64?: string;
    opsSessionSecret?: string;
  };
  rateLimit: { ingestPerMinute?: number; publicPerMinute?: number; opsAuthPerMinute?: number };
  uploadSessionTtlSeconds: number;
  flags: { publicSite: boolean; ingest: boolean; mediaUpload: boolean };
};

export type WorkerServerConfig = {
  service: "worker";
  nodeEnv: "development" | "test" | "production";
  workerDatabaseUrl: string;
  storage: StorageConfig;
  security: { mediaFileMaxBytes: number };
  malware: { mode: "CLAMAV" | "TEST_SAFE"; command: string };
  flags: { worker: boolean };
};

export type ServerConfig = ApiServerConfig | WorkerServerConfig;
export type ServerConfigOptions = { repositoryRoot?: string };
export type ServerEnvironment = Record<string, string | undefined>;

export function loadApiServerConfig(
  environment?: ServerEnvironment,
  options?: ServerConfigOptions,
): Readonly<ApiServerConfig>;
export function loadWorkerServerConfig(
  environment?: ServerEnvironment,
  options?: ServerConfigOptions,
): Readonly<WorkerServerConfig>;
/** @deprecated Gunakan loader yang sesuai dengan proses runtime. */
export const loadServerConfig: typeof loadApiServerConfig;
export function safeConfigSummary(config: ServerConfig): Record<string, unknown>;
