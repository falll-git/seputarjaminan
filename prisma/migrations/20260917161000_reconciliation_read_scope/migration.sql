-- Reconciliation reads actual lifecycle under the worker's existing RLS scope.
-- Read only: do not grant registry secrets, contact/profile writes or ownership.
GRANT SELECT ON institutions, bprs_profiles, whatsapp_contacts TO sj_worker;
