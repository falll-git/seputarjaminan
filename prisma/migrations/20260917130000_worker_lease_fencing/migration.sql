-- Additive: no existing job/media state is rewritten. Stop old workers before
-- deploying the new worker; pre-upgrade leases may expire and be reclaimed.
ALTER TABLE central_jobs ADD COLUMN lease_token UUID;

-- Private ops retry needs only these columns, not arbitrary payload mutation.
GRANT UPDATE (state, available_at, lease_until, lease_token, attempt_count,
  last_error_code, updated_at) ON central_jobs TO sj_ops;
