import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { inspectSarif, checkDirectory } from "./check-codeql-results.mjs";

function report(results = [], rules = []) {
  return { version: "2.1.0", runs: [{ tool: { driver: { name: "CodeQL", rules } }, results }] };
}

test("laporan kosong yang sah lulus, warning dan error tidak boleh disembunyikan", () => {
  assert.deepEqual(inspectSarif(report()), []);
  for (const level of ["warning", "error"]) {
    assert.equal(inspectSarif(report([{ ruleId: "security/example", level }])).length, 1);
  }
  assert.equal(inspectSarif(report([{ ruleId: "security/example", suppressions: [{ kind: "inSource" }] }])).length, 1);
});

test("severity High tetap memblokir meskipun level note atau default", () => {
  const rules = [{ id: "security/example", properties: { "security-severity": "7.5" }, defaultConfiguration: { level: "note" } }];
  assert.equal(inspectSarif(report([{ ruleId: "security/example" }], rules)).length, 1);
  assert.equal(inspectSarif(report([{ ruleId: "security/example", level: "note" }], rules)).length, 1);
});

test("laporan tidak lengkap dan analisis gagal tidak boleh dianggap hijau", () => {
  for (const value of [null, {}, { version: "2.1.0", runs: [] }, { version: "2.1.0", runs: [{ results: [] }] }]) {
    assert.throws(() => inspectSarif(value));
  }
  const failed = report();
  failed.runs[0].invocations = [{ executionSuccessful: false }];
  assert.throws(() => inspectSarif(failed), /tidak selesai/);
});

test("gate membaca semua laporan dan menolak folder kosong atau JSON terpotong", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "codeql-gate-test-"));
  try {
    assert.throws(() => checkDirectory(directory), /Tidak ada laporan/);
    fs.writeFileSync(path.join(directory, "javascript.sarif"), "{");
    assert.throws(() => checkDirectory(directory));
    fs.writeFileSync(path.join(directory, "javascript.sarif"), JSON.stringify(report()));
    assert.doesNotThrow(() => checkDirectory(directory));
    fs.writeFileSync(path.join(directory, "other.sarif"), JSON.stringify(report([{ ruleId: "security/example" }])));
    assert.throws(() => checkDirectory(directory), /temuan/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
