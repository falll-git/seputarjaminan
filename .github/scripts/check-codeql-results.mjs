import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export function inspectSarif(document) {
  if (document?.version !== "2.1.0" || !Array.isArray(document.runs) || document.runs.length === 0) {
    throw new Error("CodeQL tidak menghasilkan laporan SARIF yang lengkap.");
  }
  const findings = [];
  for (const run of document.runs) {
    if (run.tool?.driver?.name !== "CodeQL" || !Array.isArray(run.results)) {
      throw new Error("Laporan CodeQL tidak memiliki hasil analisis yang valid.");
    }
    if (run.invocations?.some((invocation) => invocation.executionSuccessful === false)) {
      throw new Error("Analisis CodeQL tidak selesai dengan sukses.");
    }
    const rules = new Map((run.tool.driver.rules || []).map((rule) => [rule.id, rule]));
    for (const result of run.results) {
      const rule = rules.get(result.ruleId);
      const severity = Number(rule?.properties?.["security-severity"] || 0);
      const level = result.level || rule?.defaultConfiguration?.level || "warning";
      if (level === "error" || level === "warning" || severity >= 7) {
        const location = result.locations?.[0]?.physicalLocation;
        findings.push({
          rule: result.ruleId || "unknown",
          file: location?.artifactLocation?.uri || "unknown",
          line: location?.region?.startLine || 0,
          level,
        });
      }
    }
  }
  return findings;
}

export function checkDirectory(directory) {
  if (!directory) throw new Error("Direktori hasil CodeQL wajib diberikan.");
  const reports = fs.readdirSync(directory).filter((filename) => filename.endsWith(".sarif"));
  if (reports.length === 0) throw new Error("Tidak ada laporan SARIF; gate tidak dapat dinyatakan lulus.");
  const findings = reports.flatMap((filename) =>
    inspectSarif(JSON.parse(fs.readFileSync(path.join(directory, filename), "utf8"))),
  );
  if (findings.length > 0) {
    for (const finding of findings) {
      console.error(`${finding.rule}: ${finding.file}:${finding.line} (${finding.level})`);
    }
    throw new Error(`CodeQL menemukan ${findings.length} temuan yang harus diselesaikan.`);
  }
  console.log(`CodeQL gate lulus: ${reports.length} laporan tanpa warning/error atau temuan High/Critical.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    checkDirectory(process.argv[2]);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
