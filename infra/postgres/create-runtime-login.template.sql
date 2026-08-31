-- Template psql. Nilai login_role dan login_password wajib diberikan oleh
-- secret manager/provisioning, bukan disimpan di repository.

CREATE ROLE :"login_role"
  LOGIN
  PASSWORD :'login_password'
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  INHERIT
  NOREPLICATION
  NOBYPASSRLS;

GRANT :"membership_role" TO :"login_role";
