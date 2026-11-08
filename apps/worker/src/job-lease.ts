import type { Prisma } from "../../../generated/prisma/client.ts";
import type { WorkerDatabase } from "./database.js";

export type ClaimedJob = {
  id: string;
  institution_id: string | null;
  job_type: string;
  payload: any;
  attempt_count: number;
  lease_token: string;
};

export class LeaseLostError extends Error {
  constructor() { super("Worker no longer owns the job lease."); this.name = "LeaseLostError"; }
}

// Database clock is authoritative; a timed-out owner cannot renew itself.
export async function renewLease(database: WorkerDatabase, job: ClaimedJob, leaseMs: number) {
  const count = await database.$executeRaw`
    UPDATE central_jobs SET lease_until=clock_timestamp()+${leaseMs}*interval '1 millisecond', updated_at=clock_timestamp()
    WHERE id=${job.id}::uuid AND lease_token=${job.lease_token}::uuid
      AND state='PROCESSING' AND lease_until>clock_timestamp()
  `;
  if (count !== 1) throw new LeaseLostError();
}

export async function assertLease(transaction: Prisma.TransactionClient, job: ClaimedJob) {
  const rows = await transaction.$queryRaw<{id:string}[]>`
    SELECT id FROM central_jobs WHERE id=${job.id}::uuid
      AND lease_token=${job.lease_token}::uuid AND state='PROCESSING'
      AND lease_until>clock_timestamp() FOR UPDATE
  `;
  if (rows.length !== 1) throw new LeaseLostError();
}
