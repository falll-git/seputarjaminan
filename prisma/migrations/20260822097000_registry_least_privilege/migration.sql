-- Authentication registry uses its own read-only credential. It must be able
-- to resolve exactly the institution currently asserted by a signed request,
-- but it must not inherit ingest write privileges.
CREATE OR REPLACE FUNCTION sj_can_access_institution(row_institution_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $function$
  SELECT
    sj_has_database_role('sj_ops')
    OR sj_has_database_role('sj_worker')
    OR (
      (sj_has_database_role('sj_registry') OR sj_has_database_role('sj_ingest'))
      AND row_institution_id = sj_current_institution_id()
    )
$function$;

GRANT SELECT ON institutions, institution_installations, institution_keys TO sj_registry;
