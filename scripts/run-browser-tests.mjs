import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
await access(new URL("../.next/BUILD_ID", import.meta.url));

let fixtureOutput = "";
let fixtureUrl = "";
let ready = false;
let settled = false;

const fixture = spawn(process.execPath, ["--test", "tests/rendered-html.test.mjs"], {
  cwd: root,
  env: {
    ...process.env,
    SJ_VISUAL_FIXTURE_HOLD: "true",
    SJ_VISUAL_FIXTURE_ASSET_COUNT: "5",
    SJ_VISUAL_FIXTURE_INSTITUTION_COUNT: "5",
    SJ_VISUAL_FIXTURE_MEDIA_COUNT: "3",
  },
  stdio: ["ignore", "pipe", "pipe"],
});

function collect(chunk) {
  const text = chunk.toString();
  fixtureOutput = `${fixtureOutput}${text}`.slice(-2_000_000);
  const urlMatch = text.match(/VISUAL_FIXTURE_URL=(http:\/\/127\.0\.0\.1:\d+)/u);
  if (urlMatch) fixtureUrl = urlMatch[1];
  if (/VISUAL_FIXTURE_READY=/u.test(text)) ready = true;
}

fixture.stdout.on("data", collect);
fixture.stderr.on("data", collect);

async function waitForFixture() {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (fixture.exitCode !== null) throw new Error(`Fixture browser berhenti sebelum siap.\n${fixtureOutput}`);
    if (fixtureUrl && ready) return fixtureUrl;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Fixture browser tidak siap dalam 120 detik.\n${fixtureOutput}`);
}

async function stopFixture() {
  if (settled || fixture.exitCode !== null) return;
  settled = true;
  const exited = new Promise((resolve) => fixture.once("exit", resolve));
  fixture.kill("SIGTERM");
  await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 10_000))]);
  if (fixture.exitCode === null) fixture.kill("SIGKILL");
}

try {
  const baseUrl = await waitForFixture();
  const playwrightCli = fileURLToPath(new URL("../node_modules/@playwright/test/cli.js", import.meta.url));
  const browser = spawn(process.execPath, [playwrightCli, "test", "--config", "playwright.config.ts"], {
    cwd: root,
    env: { ...process.env, SJ_BROWSER_BASE_URL: baseUrl },
    stdio: "inherit",
  });
  const exitCode = await new Promise((resolve, reject) => {
    browser.once("error", reject);
    browser.once("exit", (code, signal) => resolve(code ?? (signal ? 1 : 0)));
  });
  assert.equal(exitCode, 0, "Browser test gagal.");
} finally {
  await stopFixture();
}
