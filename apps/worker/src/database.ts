import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "../../../generated/prisma/client.ts";

export function createWorkerDatabase(connectionString: string) {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString, options: "-c timezone=UTC" }),
  });
}

export type WorkerDatabase = ReturnType<typeof createWorkerDatabase>;

export async function withInstitution<T>(
  database: WorkerDatabase,
  institutionId: string,
  handler: (transaction: Prisma.TransactionClient) => Promise<T>,
) {
  return database.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT set_config('app.current_institution_id', ${institutionId}, true)`;
    return handler(transaction);
  });
}
