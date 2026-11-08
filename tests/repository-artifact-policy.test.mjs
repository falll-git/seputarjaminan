import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Read the exact production pattern without importing its Git/audit entry point.
// These tests create no repository, fixture, database, service or temporary file.
const auditSource = readFileSync(new URL("../scripts/audit-repository.mjs", import.meta.url), "utf8");
const declarations = [...auditSource.matchAll(/^const forbiddenDirectory = \/(.+)\/([a-z]*)\s*;\s*$/gmu)];

function productionDirectoryPolicy() {
  assert.equal(declarations.length, 1, "The production artifact-directory policy must be explicit and unique.");
  const [, pattern, flags] = declarations[0];
  assert.equal(flags, "u", "Keep the reviewed stateless production pattern flags.");
  return new RegExp(pattern, flags);
}

test("the exact production artifact-directory literal can be inspected without executing Git", () => {
  assert.ok(productionDirectoryPolicy() instanceof RegExp);
});

test("release candidates reject singular/plural output evidence and existing build/test directories", () => {
  const policy = productionDirectoryPolicy();
  for (const relativePath of [
    "output", "output/", "output/screenshots/home.png", "output/playwright/receipt.json",
    "outputs", "outputs/screenshots/mobile.png", "node_modules/pkg/index.js", ".next/cache/data.json",
    "dist/server.js", "out/index.html", "coverage/report.json", "test-results/test.png",
    "playwright-report/index.html", "quality-reports/report.json", "work/fixture.json", "previews/home.png",
  ]) {
    assert.equal(policy.test(relativePath), true, `Release artifact path must be rejected: ${relativePath}`);
  }
});

test("authored app/public/docs source and similarly named files are not blanket-blocked", () => {
  const policy = productionDirectoryPolicy();
  for (const relativePath of [
    "app/page.tsx", "public/logo.svg", "docs/release.md", "apps/api/src/app.ts",
    "packages/storage/src/index.mjs", "tests/repository-artifact-policy.test.mjs",
    ".github/workflows/quality.yml", "output-widget.ts", "outputs-helper.mjs",
    "public/output/logo.svg", "app/output/page.tsx",
  ]) {
    assert.equal(policy.test(relativePath), false, `Authored source must not be blanket-blocked: ${relativePath}`);
  }
});

test("Git ignores root output evidence while the production audit still rejects tracked artifacts", () => {
  const ignores = readFileSync(new URL("../.gitignore", import.meta.url), "utf8").split(/\r?\n/u);
  assert.equal(ignores.filter((line) => line === "/output/").length, 1);
  assert.ok(ignores.includes("/outputs/"));
  assert.equal(productionDirectoryPolicy().test("output/already-tracked.png"), true);
  assert.match(auditSource, /"ls-files",\s*"--cached",\s*"--others",\s*"--exclude-standard"/u);
});
