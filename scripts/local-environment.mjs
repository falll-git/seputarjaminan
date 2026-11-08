import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, readdirSync } from "node:fs";
import { parse } from "dotenv";
import { loadApiServerConfig, loadWorkerServerConfig } from "../packages/config/src/server.mjs";
import { loadWebsiteConfig } from "../packages/config/src/public.mjs";

export const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
export const defaultConfigDirectory = path.resolve(repositoryRoot, "../seputarjaminan-local/config");
const storage = ["SJ_STORAGE_PROVIDER", "SJ_STORAGE_ROOT", "SJ_STORAGE_STOP_FREE_BYTES", "SJ_S3_ENDPOINT", "SJ_S3_REGION", "SJ_S3_BUCKET", "SJ_S3_ACCESS_KEY_ID", "SJ_S3_SECRET_ACCESS_KEY", "SJ_S3_FORCE_PATH_STYLE"];
export const apiDatabaseKeys = ["SJ_REGISTRY_DATABASE_URL", "SJ_INGEST_DATABASE_URL", "SJ_PUBLIC_DATABASE_URL", "SJ_OPS_DATABASE_URL"];
export const scopes = {
  website: ["SJ_PUBLIC_API_BASE_URL", "SJ_ALLOW_LOOPBACK_API"],
  api: ["NODE_ENV", "LOG_LEVEL", "SJ_API_HOST", "SJ_API_PORT", ...apiDatabaseKeys, "SJ_REDIS_URL", "SJ_PUBLIC_API_BASE_URL", "SJ_PUBLIC_MEDIA_BASE_URL", ...storage,
    "SJ_UPLOAD_SESSION_TTL_SECONDS", "SJ_SIGNATURE_TOLERANCE_SECONDS", "SJ_NONCE_TTL_SECONDS", "SJ_EVENT_BODY_MAX_BYTES", "SJ_MEDIA_FILE_MAX_BYTES", "SJ_MEDIA_TOTAL_MAX_BYTES",
    "SJ_RATE_LIMIT_INGEST_PER_MINUTE", "SJ_RATE_LIMIT_PUBLIC_PER_MINUTE", "SJ_RATE_LIMIT_OPS_AUTH_PER_MINUTE", "SJ_OPS_ENCRYPTION_KEY_BASE64", "SJ_OPS_SESSION_SECRET",
    "SJ_PUBLIC_SITE_ENABLED", "SJ_INGEST_ENABLED", "SJ_MEDIA_UPLOAD_ENABLED", "SJ_CONTROL_MONITORING_ENABLED", "SJ_CONTROL_MONITORING_INSTANCE_ID", "SJ_CONTROL_MONITORING_KEY_ID",
    "SJ_CONTROL_MONITORING_PUBLIC_KEY", "SJ_CONTROL_MONITORING_RESPONSE_KEY_ID", "SJ_CONTROL_MONITORING_RESPONSE_PRIVATE_KEY", "SJ_CONTROL_MONITORING_AUDIENCE", "SJ_CONTROL_MONITORING_FRONTEND_URL", "SJ_CONTROL_MONITORING_PROBE_TIMEOUT_MS", "SJ_WORKER_HEARTBEAT_KEY"],
  worker: ["NODE_ENV", "LOG_LEVEL", "SJ_WORKER_DATABASE_URL", "SJ_REDIS_URL", ...storage, "SJ_MEDIA_FILE_MAX_BYTES", "SJ_MALWARE_SCAN_MODE", "SJ_CLAMDSCAN_COMMAND", "SJ_CLAMAV_DOCKER_CONTAINER", "SJ_WORKER_ENABLED", "SJ_WORKER_HEARTBEAT_KEY", "SJ_WORKER_HEARTBEAT_INTERVAL_MS", "SJ_WORKER_HEARTBEAT_TTL_MS"],
  migration: ["DATABASE_URL"],
};
export function fail(code) { throw new Error(code); }
export function scopeOnly(scope, environment) {
  if (!Object.hasOwn(scopes, scope)) fail("UNKNOWN_SCOPE");
  if (Object.keys(environment).some((key) => !scopes[scope].includes(key))) fail("OUT_OF_SCOPE_CONFIG");
  return { ...environment };
}
function url(value, protocols, code) {
  let result;
  try { result = new URL(value); } catch { fail(code); }
  if (!protocols.includes(result.protocol)) fail(code);
  return result;
}
function localHost(host) { return ["localhost", "127.0.0.1", "[::1]", "::1"].includes(host.toLowerCase()); }
export function databaseIdentity(value) {
  const parsed = url(value, ["postgres:", "postgresql:"], "INVALID_DATABASE_CONFIG");
  if (!localHost(parsed.hostname) || !parsed.username || !parsed.password || parsed.pathname.length < 2) fail("DATABASE_MUST_BE_LOCAL_AND_AUTHENTICATED");
  // A service parameter can redirect libpq away from the inspected target.
  if ([...parsed.searchParams.keys()].some((key) => !["schema", "connection_limit", "pool_timeout", "sslmode"].includes(key))) fail("UNSUPPORTED_DATABASE_PARAMETER");
  return { login: decodeURIComponent(parsed.username), target: `${parsed.hostname}:${parsed.port || "5432"}${parsed.pathname}:${parsed.searchParams.get("schema") || "public"}` };
}
export function validateProfile(scope, values, root = repositoryRoot) {
  const environment = scopeOnly(scope, values);
  if (scope === "website") {
    const api = url(environment.SJ_PUBLIC_API_BASE_URL, ["http:", "https:"], "INVALID_WEBSITE_API");
    if (!localHost(api.hostname) || api.username || api.password || api.search || api.hash || api.pathname !== "/") fail("WEBSITE_REQUIRES_LOCAL_API_ORIGIN");
    if (environment.SJ_ALLOW_LOOPBACK_API && !["true", "false"].includes(environment.SJ_ALLOW_LOOPBACK_API)) fail("INVALID_LOOPBACK_FLAG");
    loadWebsiteConfig(environment);
  } else if (scope === "migration") {
    databaseIdentity(environment.DATABASE_URL);
  } else {
    if (environment.NODE_ENV !== "development") fail("LOCAL_RUNTIME_REQUIRES_DEVELOPMENT");
    const keys = scope === "api" ? apiDatabaseKeys : ["SJ_WORKER_DATABASE_URL"];
    const identities = keys.map((key) => databaseIdentity(environment[key]));
    if (identities.some(({ login }) => ["postgres", "rdsadmin", "cloudsqlsuperuser", "azure_superuser"].includes(login.toLowerCase()))) fail("PRIVILEGED_RUNTIME_LOGIN");
    if (new Set(identities.map(({ login }) => login)).size !== identities.length || new Set(identities.map(({ target }) => target)).size !== 1) fail("DATABASE_SCOPES_NOT_SEPARATED");
    const redis = url(environment.SJ_REDIS_URL, ["redis:", "rediss:"], "INVALID_REDIS_CONFIG");
    if (!localHost(redis.hostname)) fail("REDIS_MUST_BE_LOCAL");
    const flags = scope === "api" ? ["SJ_PUBLIC_SITE_ENABLED", "SJ_INGEST_ENABLED", "SJ_MEDIA_UPLOAD_ENABLED", "SJ_CONTROL_MONITORING_ENABLED"] : ["SJ_WORKER_ENABLED"];
    if (flags.some((key) => environment[key] !== "false")) fail("OPS01_ACTIVATION_LOCKED");
    if (scope === "worker" && environment.SJ_MALWARE_SCAN_MODE !== "CLAMAV") fail("OPERATIONAL_SCANNER_REQUIRES_CLAMAV");
    if (scope === "api" && (!localHost(environment.SJ_API_HOST || "") || !environment.SJ_API_PORT)) fail("API_MUST_BIND_EXPLICIT_LOOPBACK");
    try {
      (scope === "api" ? loadApiServerConfig : loadWorkerServerConfig)(environment, { repositoryRoot: root });
    } catch { fail("SERVER_CONFIG_INVALID"); }
  }
  return environment;
}
export function validateProfiles(profiles, root = repositoryRoot) {
  for (const scope of Object.keys(scopes)) validateProfile(scope, profiles[scope], root);
  const all = [...apiDatabaseKeys.map((key) => profiles.api[key]), profiles.worker.SJ_WORKER_DATABASE_URL, profiles.migration.DATABASE_URL].map(databaseIdentity);
  if (new Set(all.map(({ login }) => login)).size !== all.length || new Set(all.map(({ target }) => target)).size !== 1) fail("CROSS_PROCESS_DATABASE_SCOPE_MISMATCH");
  for (const key of [...storage, "SJ_REDIS_URL", "SJ_WORKER_HEARTBEAT_KEY"]) {
    if (profiles.api[key] !== profiles.worker[key]) fail("SHARED_SERVICE_CONFIG_MISMATCH");
  }
  if (profiles.website.SJ_PUBLIC_API_BASE_URL !== profiles.api.SJ_PUBLIC_API_BASE_URL) fail("WEBSITE_API_MISMATCH");
  const api = new URL(profiles.api.SJ_PUBLIC_API_BASE_URL);
  if (api.port !== profiles.api.SJ_API_PORT || api.hostname !== profiles.api.SJ_API_HOST) fail("API_ENDPOINT_MISMATCH");
  if (profiles.api.SJ_PUBLIC_MEDIA_BASE_URL !== `${api.origin}/v1/public/media`) fail("MEDIA_ENDPOINT_MISMATCH");
  return profiles;
}
export function readProfile(scope, directory = defaultConfigDirectory) {
  if (!Object.hasOwn(scopes, scope)) fail("UNKNOWN_SCOPE");
  let values;
  try { values = parse(readFileSync(path.join(directory, `${scope}.env`))); }
  catch { fail("PROFILE_FILE_UNAVAILABLE"); }
  return validateProfile(scope, values);
}
export function readProfiles(directory = defaultConfigDirectory) {
  const profiles = Object.fromEntries(Object.keys(scopes).map((scope) => [scope, readProfile(scope, directory)]));
  return validateProfiles(profiles);
}
// Next auto-loads root env files even when launched with a sanitized process.env.
// Reject contamination in every auto-load candidate before spawning Next.
export function assertWebsiteEnvFiles(root = repositoryRoot) {
  for (const name of readdirSync(root)) {
    if (!/^\.env(?:\.(?:local|development|production|test)(?:\.local)?)?$/.test(name)) continue;
    scopeOnly("website", parse(readFileSync(path.join(root, name))));
  }
}
export function childEnvironment(scope, values, inherited = process.env) {
  const selected = scopeOnly(scope, values);
  const result = {};
  const osKeys = new Set(["PATH", "SYSTEMROOT", "WINDIR", "COMSPEC", "PATHEXT", "TEMP", "TMP", "TMPDIR", "USERPROFILE", "HOME", "APPDATA", "LOCALAPPDATA", "LANG", "LC_ALL", "TERM"]);
  for (const [key, value] of Object.entries(inherited)) if (osKeys.has(key.toUpperCase()) && value !== undefined) result[key] = value;
  return { ...result, ...selected };
}
