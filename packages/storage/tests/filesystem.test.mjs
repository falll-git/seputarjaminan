import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { FilesystemStorageAdapter, resolveInsideRoot } from "../src/index.mjs";

test("filesystem adapter menulis, membaca, dan memverifikasi checksum", async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "sj-storage-test-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const adapter = new FilesystemStorageAdapter({ root });
  const bytes = Buffer.from("media sintetis untuk automated test", "utf8");
  const checksum = createHash("sha256").update(bytes).digest("hex");
  const key = "institutions/test/temporary/media-source";
  const result = await adapter.putObject(key, bytes, {
    maxBytes: 1024,
    expectedSha256: checksum,
  });
  assert.equal(result.sha256, checksum);
  assert.equal(await adapter.objectExists(key), true);
  const stored = await adapter.readObject(key);
  const chunks = [];
  for await (const chunk of stored.body) chunks.push(chunk);
  assert.deepEqual(Buffer.concat(chunks), bytes);
});

test("filesystem adapter menolak traversal, oversize, dan checksum salah", async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "sj-storage-test-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const adapter = new FilesystemStorageAdapter({ root });
  assert.throws(() => resolveInsideRoot(root, "../secret"));
  await assert.rejects(
    adapter.putObject("institutions/test/temporary/oversize", Buffer.alloc(10), { maxBytes: 5 }),
    (error) => error.code === "MEDIA_TOO_LARGE",
  );
  await assert.rejects(
    adapter.putObject("institutions/test/temporary/checksum", Buffer.from("x"), {
      expectedSha256: "0".repeat(64),
    }),
    (error) => error.code === "MEDIA_CHECKSUM_MISMATCH",
  );
});

test("penghapusan otomatis tidak menyentuh media bisnis", async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "sj-storage-test-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const adapter = new FilesystemStorageAdapter({ root });
  await adapter.putObject("institutions/test/media/business-object", Buffer.from("x"));
  await assert.rejects(adapter.deleteTemporaryObject("institutions/test/media/business-object"));
});
