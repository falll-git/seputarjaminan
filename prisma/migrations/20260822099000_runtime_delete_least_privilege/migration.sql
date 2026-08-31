-- Runtime code replaces category/media snapshots atomically and rebuilds
-- disposable search projections. Grant only those exact delete capabilities.
GRANT DELETE ON
  land_details,
  building_details,
  machine_details,
  vehicle_details,
  publication_media
TO sj_ingest;

GRANT DELETE ON public_search_documents TO sj_worker;
