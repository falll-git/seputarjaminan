import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "../../../generated/prisma/client.ts";

function createClient(connectionString: string) {
  const adapter = new PrismaPg({ connectionString, options: "-c timezone=UTC" });
  return new PrismaClient({ adapter });
}

export type DatabaseClients = ReturnType<typeof createDatabaseClients>;
export type TransactionClient = Prisma.TransactionClient;

export function createDatabaseClients(config: {
  registryDatabaseUrl: string;
  ingestDatabaseUrl: string;
  publicDatabaseUrl: string;
  opsDatabaseUrl: string;
}) {
  const registry = createClient(config.registryDatabaseUrl);
  const ingest = createClient(config.ingestDatabaseUrl);
  const publicRead = createClient(config.publicDatabaseUrl);
  const ops = createClient(config.opsDatabaseUrl);
  return {
    registry,
    ingest,
    publicRead,
    ops,
    async disconnect() {
      await Promise.all([
        registry.$disconnect(),
        ingest.$disconnect(),
        publicRead.$disconnect(),
        ops.$disconnect(),
      ]);
    },
  };
}

export async function withInstitution<T>(
  client: PrismaClient,
  institutionId: string,
  handler: (transaction: TransactionClient) => Promise<T>,
  options: { isolationLevel?: Prisma.TransactionIsolationLevel } = {},
) {
  return client.$transaction(
    async (transaction) => {
      await transaction.$executeRaw`SELECT set_config('app.current_institution_id', ${institutionId}, true)`;
      return handler(transaction);
    },
    { isolationLevel: options.isolationLevel },
  );
}
