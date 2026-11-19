import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const buildTools = ["next", "esbuild"];
const builds = [
  { name: "website", args: ["run", "build"] },
  { name: "API", args: ["run", "build", "--workspace", "@seputarjaminan/api"] },
  { name: "worker", args: ["run", "build", "--workspace", "@seputarjaminan/worker"] },
];

// This detects the stale build-tool tree found during release review. A fresh
// npm ci remains the install contract for the complete dependency graph.
export function verifyReleaseBuildTools(root) {
  const lock = JSON.parse(readFileSync(path.join(root, "package-lock.json"), "utf8"));
  if (lock.lockfileVersion !== 3) throw new Error("Release build memerlukan lockfile v3.");
  for (const name of buildTools) {
    const expected = lock.packages?.[`node_modules/${name}`]?.version;
    if (!expected) throw new Error(`Versi build tool ${name} tidak ditemukan dalam lockfile.`);
    let installed;
    try {
      installed = JSON.parse(readFileSync(path.join(root, "node_modules", name, "package.json"), "utf8")).version;
    } catch {
      throw new Error(`Build tool ${name} belum terpasang; jalankan npm ci di checkout rilis.`);
    }
    if (installed !== expected) {
      throw new Error(`Build tool ${name} terpasang ${installed}, lockfile ${expected}; jalankan npm ci di checkout rilis.`);
    }
  }
}

export function buildRelease({ root = repositoryRoot, npmCli = process.env.npm_execpath, run = spawnSync } = {}) {
  // Check both tools before any builder can replace .next or a workspace dist.
  verifyReleaseBuildTools(root);
  if (!npmCli || !path.isAbsolute(npmCli) || path.basename(npmCli) !== "npm-cli.js") {
    throw new Error("Jalankan entrypoint rilis melalui npm run build:release.");
  }
  for (const build of builds) {
    const result = run(process.execPath, [npmCli, ...build.args], {
      cwd: root,
      env: process.env,
      stdio: "inherit",
      shell: false,
      windowsHide: true,
    });
    if (result.error) throw result.error;
    if (result.status !== 0) {
      const error = new Error(`Build rilis ${build.name} gagal; build berikutnya tidak dijalankan.`);
      error.exitCode = Number.isInteger(result.status) && result.status > 0 ? result.status : 1;
      throw error;
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    buildRelease();
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Build rilis gagal.");
    process.exitCode = error.exitCode || 1;
  }
}
