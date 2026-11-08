export type ClamAvCommand = { command: string; dockerContainer?: string };
export function clamAvInvocation(config: ClamAvCommand): { command: string; args: string[] };
export function scanWithClamAv(config: ClamAvCommand, bytes: Buffer): Promise<"CLEAN" | "INFECTED">;
