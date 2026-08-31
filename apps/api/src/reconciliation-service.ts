import { payloadChecksum, validateSchema } from "@seputarjaminan/contracts";
import type { DatabaseClients } from "./database.js";
import { withInstitution } from "./database.js";
import { ApiError } from "./errors.js";

const MANIFEST_SCHEMA = "https://seputarjaminan.com/contracts/v1/reconciliation-manifest.schema.json";

export class ReconciliationService {
  constructor(private databases: DatabaseClients) {}

  async create(manifest: any, authentication: { institutionId: string; installationId: string }, requestId: string) {
    const validation = validateSchema(MANIFEST_SCHEMA, manifest);
    if (!validation.valid) {
      throw new ApiError(422, "RECONCILIATION_MANIFEST_INVALID", "Data pemeriksaan kesesuaian tidak valid.");
    }
    if (manifest.institution_id !== authentication.institutionId) {
      throw new ApiError(403, "INSTITUTION_MISMATCH", "Identitas BPRS tidak sesuai koneksi.");
    }
    const run = await withInstitution(this.databases.ingest, authentication.institutionId, async (transaction) => {
      const created = await transaction.reconciliationRun.create({
        data: {
          institutionId: authentication.institutionId,
          installationId: authentication.installationId,
          manifestChecksum: payloadChecksum(manifest),
          manifest,
        },
      });
      await transaction.centralJob.create({
        data: {
          institutionId: authentication.institutionId,
          jobType: "RECONCILE_MANIFEST",
          dedupeKey: "reconcile:" + created.id,
          payload: { reconciliation_run_id: created.id },
        },
      });
      return created;
    });
    return {
      request_id: requestId,
      run_id: run.id,
      status: run.state,
      count_checked: run.countChecked,
      count_mismatch: run.countMismatch,
      mismatches: [],
    };
  }

  async get(runId: string, institutionId: string, requestId: string) {
    const run = await withInstitution(this.databases.ingest, institutionId, (transaction) =>
      transaction.reconciliationRun.findFirst({ where: { id: runId, institutionId } }),
    );
    if (!run) throw new ApiError(404, "RECONCILIATION_NOT_FOUND", "Hasil pemeriksaan tidak tersedia.");
    return {
      request_id: requestId,
      run_id: run.id,
      status: run.state,
      count_checked: run.countChecked,
      count_mismatch: run.countMismatch,
      mismatches: Array.isArray(run.safeMismatchReport) ? run.safeMismatchReport : [],
    };
  }
}
