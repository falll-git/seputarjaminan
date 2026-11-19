import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { buildRelease } from "../scripts/build-release.mjs";

function fixture(t) {
  const temporaryRoot = realpathSync(os.tmpdir());
  const root = mkdtempSync(path.join(temporaryRoot, "sj-release-build-"));
  t.after(() => {
    assert.equal(path.dirname(realpathSync(root)), temporaryRoot);
    assert.ok(path.basename(root).startsWith("sj-release-build-"));
    rmSync(root, { recursive: true });
  });
  const packages = { "node_modules/next": { version: "16.4.6" }, "node_modules/esbuild": { version: "0.28.2" } };
  writeFileSync(path.join(root, "package-lock.json"), JSON.stringify({ lockfileVersion: 3, packages }));
  for (const [location, entry] of Object.entries(packages)) {
    mkdirSync(path.join(root, location), { recursive: true });
    writeFileSync(path.join(root, location, "package.json"), JSON.stringify(entry));
  }
  const outputs = [".next/BUILD_ID", "apps/api/dist/server.mjs", "apps/worker/dist/server.mjs"];
  for (const output of outputs) {
    mkdirSync(path.dirname(path.join(root, output)), { recursive: true });
    writeFileSync(path.join(root, output), "previous artifact retained");
  }
  return { root, npmCli: path.join(root, "npm-cli.js"), outputs };
}

test("release build rejects stale or missing tools before any artifact is modified", t => {
  for (const [name, installed] of [["next", "16.3.8"], ["esbuild", "0.27.0"], ["next", null]]) {
    const { root, npmCli, outputs } = fixture(t);
    const file = path.join(root, "node_modules", name, "package.json");
    if (installed) writeFileSync(file, JSON.stringify({ version: installed }));
    else rmSync(file);
    assert.throws(() => buildRelease({ root, npmCli, run: () => assert.fail("builder must not start") }), /npm ci/);
    for (const output of outputs) assert.equal(readFileSync(path.join(root, output), "utf8"), "previous artifact retained");
  }
});

test("release build invokes all three required builders through the same npm CLI", t => {
  const { root, npmCli } = fixture(t);
  const calls = [];
  buildRelease({ root, npmCli, run: (executable, args, options) => { calls.push({ executable, args, options }); return { status: 0 }; } });
  assert.deepEqual(calls.map(call => call.args), [
    [npmCli, "run", "build"],
    [npmCli, "run", "build", "--workspace", "@seputarjaminan/api"],
    [npmCli, "run", "build", "--workspace", "@seputarjaminan/worker"],
  ]);
  for (const call of calls) {
    assert.equal(call.executable, process.execPath);
    assert.equal(call.options.cwd, root);
    assert.equal(call.options.shell, false);
  }
});

test("a failing build stops the release pipeline without trying the remaining service", t => {
  const { root, npmCli } = fixture(t);
  for (const failedAt of [0, 1, 2]) {
    let calls = 0;
    assert.throws(() => buildRelease({ root, npmCli, run: () => ({ status: calls++ === failedAt ? 42 : 0 }) }), error => error.exitCode === 42);
    assert.equal(calls, failedAt + 1);
  }
});

test("spawn errors and interrupted builders cannot become successful release builds", t => {
  const { root, npmCli } = fixture(t);
  const failure = Object.assign(new Error("unit spawn failure"), { code: "EACCES" });
  assert.throws(() => buildRelease({ root, npmCli, run: () => ({ error: failure, status: null }) }), error => error === failure);
  assert.throws(() => buildRelease({ root, npmCli, run: () => ({ status: null, signal: "SIGTERM" }) }), error => error.exitCode === 1);
});
