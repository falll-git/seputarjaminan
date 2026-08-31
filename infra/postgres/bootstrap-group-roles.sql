-- Jalankan sebagai administrator PostgreSQL sebelum migration aplikasi.
-- Script ini tidak membuat login dan tidak menerima atau menyimpan password.

DO $block$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sj_registry') THEN
    CREATE ROLE sj_registry NOLOGIN NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sj_public') THEN
    CREATE ROLE sj_public NOLOGIN NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sj_ingest') THEN
    CREATE ROLE sj_ingest NOLOGIN NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sj_worker') THEN
    CREATE ROLE sj_worker NOLOGIN NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'sj_ops') THEN
    CREATE ROLE sj_ops NOLOGIN NOBYPASSRLS;
  END IF;
END
$block$;

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
