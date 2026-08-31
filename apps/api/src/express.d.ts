import type { Logger } from "pino";

declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer;
      integrationAuth?: {
        institutionId: string;
        installationId: string;
        keyId: string;
        nonceHash: string;
        requestTimestamp: Date;
      };
      log?: Logger;
    }
  }
}

export {};
