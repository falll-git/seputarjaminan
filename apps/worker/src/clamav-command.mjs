import { execFile } from "node:child_process";

// No shell and no host filesystem mounts. Docker is an explicit LOCAL transport;
// production continues to invoke its native clamdscan command.
export function clamAvInvocation(config) {
  if (config.dockerContainer !== undefined) {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/.test(config.dockerContainer)) throw new Error("INVALID_SCANNER_CONTAINER");
    return { command: "docker", args: ["exec", "-i", config.dockerContainer, "clamdscan", "--stream", "--no-summary", "-"] };
  }
  if (!config.command) throw new Error("SCANNER_COMMAND_REQUIRED");
  return { command: config.command, args: ["--stream", "--no-summary", "-"] };
}

export function scanWithClamAv(config, bytes, execute = execFile) {
  const { command, args } = clamAvInvocation(config);
  return new Promise((resolve, reject) => {
    let inputError = false;
    const child = execute(command, args, { timeout: 120000, maxBuffer: 65536, windowsHide: true, encoding: "utf8" }, (error, stdout) => {
      // docker itself also uses exit1. Only a scanner detection is MALWARE;
      // transport failure, unavailable daemon and unrecognised output fail closed.
      if (error?.code === 1 && /: [^\r\n]+ FOUND\r?\n?$/.test(stdout || "")) return resolve("INFECTED");
      if (error || inputError || !/: OK\r?\n?$/.test(stdout || "")) return reject(new Error("SCANNER_UNAVAILABLE"));
      resolve("CLEAN");
    });
    child.stdin.on("error", () => { inputError = true; });
    child.stdin.end(bytes);
  });
}
