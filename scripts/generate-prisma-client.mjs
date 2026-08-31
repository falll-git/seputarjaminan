import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const prismaCli = fileURLToPath(
  new URL("../node_modules/prisma/build/index.js", import.meta.url),
);
const generateOnlyDatabaseUrl =
  "postgresql://prisma_generate:prisma_generate@127.0.0.1:1/prisma_generate";

const result = spawnSync(process.execPath, [prismaCli, "generate"], {
  cwd: fileURLToPath(new URL("../", import.meta.url)),
  env: {
    ...process.env,
    DATABASE_URL: process.env.DATABASE_URL || generateOnlyDatabaseUrl,
  },
  stdio: "inherit",
});

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
