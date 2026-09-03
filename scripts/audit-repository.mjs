import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { open, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";

const root = process.cwd();
const tracked = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { cwd: root })
  .toString("utf8")
  .split("\0")
  .filter(Boolean);

const forbiddenDirectory = /^(?:node_modules|\.next|dist|out|coverage|test-results|playwright-report|quality-reports|outputs|work|previews)(?:\/|$)/u;
const forbiddenFile = /(?:^|\/)(?:\.env(?!\.example$)|[^/]+\.(?:pem|key|p12|pfx|jks|keystore|sqlite|db|bak|dump|log|zip|rar|7z|tgz))$/iu;
const textExtensions = new Set([".cjs", ".css", ".d.ts", ".html", ".js", ".json", ".jsx", ".md", ".mjs", ".prisma", ".sql", ".toml", ".ts", ".tsx", ".txt", ".yaml", ".yml"]);
const textBasenames = new Set([".env.example", ".gitignore", ".gitleaksignore", ".npmrc"]);
const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u,
  /\bAKIA[0-9A-Z]{16}\b/u,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/u,
  /\bgh[pousr]_[A-Za-z0-9]{30,}\b/u,
];
const problems = [];

for (const relativePath of tracked) {
  const normalized = relativePath.replaceAll("\\", "/");
  if (forbiddenDirectory.test(normalized)) problems.push(`${normalized}: artifact build/test tidak boleh dilacak Git.`);
  if (forbiddenFile.test(normalized)) problems.push(`${normalized}: file runtime/sensitif tidak boleh dilacak Git.`);

  const absolutePath = path.join(root, relativePath);
  const handle = await open(absolutePath, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
  let content;
  try {
    const metadata = await handle.stat();
    if (!metadata.isFile()) {
      problems.push(`${normalized}: bukan file biasa.`);
      continue;
    }
    if (metadata.size > 10 * 1024 * 1024) {
      problems.push(`${normalized}: file melebihi 10 MiB.`);
      continue;
    }
    if (!textExtensions.has(path.extname(normalized).toLowerCase()) && !textBasenames.has(path.basename(normalized))) continue;
    content = await handle.readFile();
    if (content.length > 10 * 1024 * 1024) problems.push(`${normalized}: file melebihi 10 MiB.`);
  } finally {
    await handle.close();
  }
  if (content.includes(0)) problems.push(`${normalized}: mengandung byte NUL.`);
  const source = content.toString("utf8");
  if (/^(?:<<<<<<<|=======|>>>>>>>)/mu.test(source)) problems.push(`${normalized}: memiliki conflict marker.`);
  if (secretPatterns.some((pattern) => pattern.test(source))) problems.push(`${normalized}: pola kredensial terlarang ditemukan.`);
}

for (const workflow of [".github/workflows/quality.yml", ".github/workflows/security.yml"]) {
  assert.ok(tracked.includes(workflow), `${workflow} wajib dilacak Git.`);
  const source = await readFile(path.join(root, workflow), "utf8");
  assert.doesNotMatch(source, /\b(?:ssh|scp|rsync|pm2)\b/iu, `${workflow} tidak boleh menjalankan deployment ke server.`);
  assert.doesNotMatch(source, /pull_request_target|workflow_run|id-token:\s*write|contents:\s*write/iu, `${workflow} meminta trigger/permission berisiko.`);
  for (const match of source.matchAll(/^\s*uses:\s*[^\s@]+@([^\s#]+)/gmu)) {
    assert.match(match[1], /^[a-f0-9]{40}$/u, `${workflow} memiliki action yang tidak dipin ke commit SHA.`);
  }
  for (const match of source.matchAll(/^\s*image:\s*([^\s#]+)/gmu)) {
    assert.match(match[1], /@sha256:[a-f0-9]{64}$/u, `${workflow} memiliki container image yang tidak dipin ke digest.`);
  }
}

assert.deepEqual(problems, [], problems.join("\n"));
console.log(`Audit repository valid: ${tracked.length} file terlacak tanpa artifact atau file sensitif terlarang.`);
