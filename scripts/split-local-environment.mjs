import { constants, existsSync, readFileSync, writeFileSync, renameSync, openSync, fsyncSync, closeSync, fstatSync, linkSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "dotenv";
import { scopes, validateProfiles, repositoryRoot, defaultConfigDirectory, fail } from "./local-environment.mjs";

export function splitEnvironment(environment) {
  const known = new Set(Object.values(scopes).flat());
  if (Object.keys(environment).some((key) => !known.has(key))) fail("UNKNOWN_SOURCE_CONFIG");
  const profiles = Object.fromEntries(Object.entries(scopes).map(([scope, keys]) => [scope, Object.fromEntries(keys.filter((key) => environment[key] !== undefined).map((key) => [key, environment[key]]))]));
  profiles.api.NODE_ENV = profiles.worker.NODE_ENV = "development";
  for (const key of ["SJ_PUBLIC_SITE_ENABLED", "SJ_INGEST_ENABLED", "SJ_MEDIA_UPLOAD_ENABLED", "SJ_CONTROL_MONITORING_ENABLED"]) profiles.api[key] = "false";
  profiles.worker.SJ_WORKER_ENABLED = "false";
  profiles.worker.SJ_MALWARE_SCAN_MODE = "CLAMAV";
  profiles.worker.SJ_CLAMDSCAN_COMMAND ||= "clamdscan";
  return validateProfiles(profiles);
}
export function serialize(environment) {
  // Literal dotenv values: no shell/Next interpolation of credential content.
  for (const value of Object.values(environment)) if (/[\r\n']/.test(value) || value.includes(String.fromCharCode(0))) fail("MULTILINE_OR_QUOTED_CONFIG_REQUIRES_MANUAL_SPLIT");
  const result = Object.entries(environment).map(([key, value]) => `${key}='${value}'`).join("\n") + "\n";
  if (JSON.stringify(parse(result)) !== JSON.stringify(environment)) fail("ENV_ROUNDTRIP_FAILED");
  return result;
}
function existingFileMatches(file, contents, mismatchCode) {
  let descriptor;
  try { descriptor = openSync(file, constants.O_RDONLY | (constants.O_NOFOLLOW || 0)); }
  catch (error) { if (error.code === "ENOENT") return false; throw error; }
  try {
    if (!fstatSync(descriptor).isFile() || readFileSync(descriptor, "utf8") !== contents) fail(mismatchCode);
    return true;
  } finally { closeSync(descriptor); }
}
function writeOnce(file, contents) {
  if (existingFileMatches(file, contents, "EXISTING_CONFIG_DIFFERS_NO_OVERWRITE")) return;
  const pending = `${file}.pending`;
  let descriptor;
  try { descriptor = openSync(pending, "wx", 0o600); }
  catch (error) {
    if (error.code !== "EEXIST") throw error;
    if (!existingFileMatches(pending, contents, "INCOMPLETE_PENDING_FILE_REQUIRES_REVIEW")) fail("INCOMPLETE_PENDING_FILE_REQUIRES_REVIEW");
  }
  if (descriptor !== undefined) {
    try { writeFileSync(descriptor, contents); fsyncSync(descriptor); }
    finally { closeSync(descriptor); }
  }
  // link is an atomic create-if-absent publication. rename would replace a
  // profile another writer created after the initial descriptor inspection.
  try { linkSync(pending, file); }
  catch (error) {
    if (error.code !== "EEXIST") throw error;
    if (!existingFileMatches(file, contents, "EXISTING_CONFIG_DIFFERS_NO_OVERWRITE")) fail("EXISTING_CONFIG_DIFFERS_NO_OVERWRITE");
  }
  unlinkSync(pending);
}
export function splitLocalFiles(root, directory) {
  // Directory must be created and access-restricted by the operator first.
  if (!existsSync(directory)) fail("CREATE_PRIVATE_CONFIG_DIRECTORY_FIRST");
  const sourcePath = path.join(root, ".env.local");
  const backup = path.join(directory, "combined-before-ops01.env");
  const current = readFileSync(sourcePath, "utf8");
  const original = existsSync(backup) ? readFileSync(backup, "utf8") : current;
  const profiles = splitEnvironment(parse(original));
  const website = "# Website only. API/worker/owner profiles live outside this repository.\n" + serialize(profiles.website);
  if (current !== original && current !== website) fail("SOURCE_CHANGED_NO_OVERWRITE");
  const files = Object.entries(profiles).map(([scope, values]) => [path.join(directory, `${scope}.env`), serialize(values)]);
  // Validate the entire plan before any write, and never overwrite a divergent profile.
  for (const [file, contents] of files) existingFileMatches(file, contents, "EXISTING_CONFIG_DIFFERS_NO_OVERWRITE");
  writeOnce(backup, original);
  for (const [file, contents] of files) writeOnce(file, contents);
  if (current !== website) {
    const temporary = path.join(root, ".env.ops01-pending");
    writeOnce(temporary, website);
    // Same-directory rename replaces the old file only after backup and all profiles exist.
    renameSync(temporary, sourcePath);
  }
  return { separated: true, profiles: Object.keys(profiles), activation: "disabled", scanner: "CLAMAV" };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length > 2) fail("NO_ARGUMENTS_EXPECTED");
    console.log(JSON.stringify(splitLocalFiles(repositoryRoot, defaultConfigDirectory)));
  } catch { console.error("Local split stopped; source/backup preserved. Check private profiles without printing their contents."); process.exitCode = 1; }
}
