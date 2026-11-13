import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm, readdir, statfs, writeFile, utimes } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
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

test("capacity reserves the incoming bytes; failed writes leave no successful object", async (context) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'sj-storage-test-'));
  context.after(() => rm(root, {recursive:true,force:true}));
  const info = await statfs(root);
  const available = Number(info.bavail) * Number(info.bsize);
  const adapter = new FilesystemStorageAdapter({root, stopFreeBytes: 1});
  await assert.rejects(adapter.putObject('institutions/test/temporary/blocked', Buffer.from('x'), {maxBytes: available * 2}), e => e.code === 'STORAGE_CAPACITY_GUARD');
  assert.deepEqual(await readdir(root), []);
});

test("cleanup removes only old exact upload fragments, never original or fresh/unrelated files", async context => {
  const root=await mkdtemp(path.join(os.tmpdir(),'sj-storage-fragments-'));
  context.after(()=>rm(root,{recursive:true,force:true}));
  const adapter=new FilesystemStorageAdapter({root}),key='institutions/test/media/object/main';
  await adapter.putObject(key,Buffer.from('main'));await adapter.putObject('institutions/test/media/object/original',Buffer.from('original'));
  const directory=path.dirname(resolveInsideRoot(root,key));
  const old='main.upload-10000000-0000-4000-8000-000000000001',fresh='main.upload-10000000-0000-4000-8000-000000000002',unrelated='other.upload-10000000-0000-4000-8000-000000000003';
  for(const name of [old,fresh,unrelated,'main.upload-not-owned'])await writeFile(path.join(directory,name),'partial');
  const yesterday=new Date(Date.now()-172800000);await utimes(path.join(directory,old),yesterday,yesterday);
  assert.equal(await adapter.cleanupTransientWrites(key,new Date(Date.now()-86400000)),1);
  assert.deepEqual((await readdir(directory)).sort(),['main','original',fresh,unrelated,'main.upload-not-owned'].sort());
});

test("mid-stream write failure preserves existing object and removes incomplete upload", async context => {
  const root=await mkdtemp(path.join(os.tmpdir(),'sj-storage-interrupted-'));
  context.after(()=>rm(root,{recursive:true,force:true}));
  const adapter=new FilesystemStorageAdapter({root}),key='institutions/test/media/image/main';
  await adapter.putObject(key,Buffer.from('previous completed bytes'));
  const body=Readable.from((async function*(){yield Buffer.from('incomplete');throw Object.assign(new Error('injected write interruption'),{code:'EIO'});})());
  await assert.rejects(adapter.putObject(key,body),error=>error.code==='EIO');
  const stored=await adapter.readObject(key);const chunks=[];for await(const chunk of stored.body)chunks.push(chunk);
  assert.equal(Buffer.concat(chunks).toString(),'previous completed bytes');
  assert.deepEqual(await readdir(path.dirname(resolveInsideRoot(root,key))),['main']);
});

test("storage byte bounds reject coercible, negative, fractional and unsafe values before writing", async context => {
  const root = await mkdtemp(path.join(os.tmpdir(), "sj-storage-bounds-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const adapter = new FilesystemStorageAdapter({ root, stopFreeBytes: 1 });
  let coerced = false;
  const hostile = { valueOf() { coerced = true; return 1; } };
  for (const value of ["1", null, {}, hostile, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => new FilesystemStorageAdapter({ root, stopFreeBytes: value }), TypeError);
    await assert.rejects(adapter.assertWritableCapacity(value), TypeError);
    await assert.rejects(adapter.putObject("institutions/test/temporary/invalid", Buffer.from("x"), { maxBytes: value }), TypeError);
  }
  assert.equal(coerced, false);
  assert.deepEqual(await readdir(root), []);
});

test("an explicit zero-byte limit permits empty bytes and rejects a nonempty body", async context => {
  const root = await mkdtemp(path.join(os.tmpdir(), "sj-storage-zero-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const adapter = new FilesystemStorageAdapter({ root });
  await assert.rejects(adapter.putObject("institutions/test/temporary/nonempty", Buffer.from("x"), { maxBytes: 0 }), error => error.code === "MEDIA_TOO_LARGE");
  const result = await adapter.putObject("institutions/test/temporary/empty", Buffer.alloc(0), { maxBytes: 0 });
  assert.equal(result.sizeBytes, 0);
  assert.equal(await adapter.objectExists("institutions/test/temporary/nonempty"), false);
});
