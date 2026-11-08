import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "../../../generated/prisma/client.ts";
import { serializeAdapterTransactions } from "../../../shared/serialized-pg.ts";

export function createWorkerDatabase(connectionString: string) {
  return new PrismaClient({
    adapter: serializeAdapterTransactions(new PrismaPg({ connectionString, connectionTimeoutMillis: 5000, options: "-c timezone=UTC -c statement_timeout=10000 -c lock_timeout=5000" })),
  });
}

export type WorkerDatabase = ReturnType<typeof createWorkerDatabase>;

export async function withInstitution<T>(
  database: WorkerDatabase,
  institutionId: string,
  handler: (transaction: Prisma.TransactionClient) => Promise<T>,
  options: { isolationLevel?: Prisma.TransactionIsolationLevel } = {},
) {
  return database.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT set_config('app.current_institution_id', ${institutionId}, true)`;
    return handler(transaction);
  }, options);
}
