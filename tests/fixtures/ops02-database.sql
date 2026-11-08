-- ISOLATED OPS-02 ONLY. Executed exclusively after container/DB identity guards.
-- No filesystem images, real contacts, API activation or worker execution.
INSERT INTO institutions(id,legal_name_internal,public_slug,state,updated_at)
SELECT md5('ops02-institution-'||n)::uuid,'OPS02 synthetic '||n,'ops02-bank-'||lpad(n::text,3,'0'),
 CASE WHEN n % 20 = 0 THEN 'SUSPENDED' ELSE 'ACTIVE' END::institution_state, now()
FROM generate_series(1,200) n;

INSERT INTO institution_installations(id,institution_id,installation_name,state,updated_at)
SELECT md5(id::text||'-installation')::uuid,id,'ops02-only','ACTIVE',now() FROM institutions;
INSERT INTO institution_keys(key_id,institution_id,installation_id,public_key)
SELECT md5(institution_id::text||'-key')::uuid,institution_id,id,'OPS02 inert key, never used for authentication' FROM institution_installations;

INSERT INTO media_objects(id,institution_id,source_media_id,source_publication_id,logical_object_key,storage_backend,purpose,state,
 sha256,detected_mime,size_bytes,width,height,delivery_object_key,delivery_mime,delivery_sha256,delivery_size_bytes,delivery_width,delivery_height,updated_at)
SELECT md5(i.id::text||'-media-'||n)::uuid,i.id,md5(i.id::text||'-source-media-'||n)::uuid,NULL,
 'ops02/no-file/'||i.id||'/'||n,'FILESYSTEM','BPRS_PUBLIC_MARK','READY',repeat('a',64),'image/webp',100,400,300,
 'ops02/no-delivery-file/'||i.id||'/'||n,'image/webp',repeat('b',64),100,400,300,now()
FROM institutions i CROSS JOIN generate_series(1,2) n;

INSERT INTO bprs_profiles(id,institution_id,source_profile_id,source_version,public_name,public_mark_media_id,short_description,
 office_city_regency,office_province,profile_updated_at,payload_checksum,state,updated_at)
SELECT md5(id::text||'-profile')::uuid,id,md5(id::text||'-source-profile')::uuid,1,legal_name_internal,
 md5(id::text||'-media-1')::uuid,'Isolated DB fixture, not a bank listing','Kota Uji','Provinsi Uji',now(),repeat('c',64),'ACTIVE',now() FROM institutions;

INSERT INTO whatsapp_contacts(id,institution_id,source_contact_id,source_version,phone_e164,message_template_version,verified_at,payload_checksum,updated_at)
SELECT md5(id::text||'-contact')::uuid,id,md5(id::text||'-source-contact')::uuid,1,'+12025550100',1,now(),repeat('d',64),now() FROM institutions;

INSERT INTO publications(id,institution_id,source_publication_id,public_reference_code,aggregate_version,profile_id,whatsapp_contact_id,
 taxonomy_version,subcategory_code,category,title,description,city_regency,province,availability,state,published_at,public_updated_at,
 last_confirmed_at,next_reconfirmation_at,payload_checksum,updated_at)
SELECT md5(i.id::text||'-pub-'||n)::uuid,i.id,md5(i.id::text||'-source-pub-'||n)::uuid,
 'SJ-'||lpad((row_number() OVER (ORDER BY i.public_slug,n))::text,8,'0'),1,
 md5(i.id::text||'-profile')::uuid,md5(i.id::text||'-contact')::uuid,1,'TANAH','TANAH',
 CASE WHEN n=1 THEN 'lahan langka ops02 ' ELSE 'tanah ops02 ' END||n,'Synthetic DB test only',
 'Kota '||(n%8),'Provinsi '||(n%5),
 CASE WHEN n%11=0 THEN 'UNAVAILABLE' ELSE 'AVAILABLE' END::public_availability,
 CASE WHEN n%9=0 THEN 'UNPUBLISHED' ELSE 'PUBLISHED' END::central_publication_state,
 now()-interval '40 days', now()-((n*200+right(i.public_slug,3)::int)||' minutes')::interval,
 now()-interval '40 days',CASE WHEN n%13=0 THEN now()-interval '1 day' ELSE now()+interval '20 days' END,
 repeat('e',64),now()
FROM institutions i CROSS JOIN generate_series(1,50) n;

INSERT INTO publication_media(institution_id,publication_id,media_object_id,sort_order,is_cover,alt_text)
SELECT institution_id,id,md5(institution_id::text||'-media-1')::uuid,0,true,'OPS02 fixture' FROM publications;
INSERT INTO land_details(publication_id,institution_id,land_area_m2)
SELECT id,institution_id,200 FROM publications;
INSERT INTO public_search_documents(publication_id,institution_id,normalized_text,filter_document,cover_media_id,projection_version,updated_at)
SELECT id,institution_id,title,'{}',md5(institution_id::text||'-media-1')::uuid,1,now() FROM publications;
INSERT INTO media_upload_sessions(id,institution_id,media_object_id,token_hash,expected_sha256,expected_mime,max_bytes,expires_at)
SELECT md5(id::text||'-upload')::uuid,id,md5(id::text||'-media-1')::uuid,md5(id::text)||md5(id::text),repeat('a',64),'image/webp',100,now()+interval '1 hour' FROM institutions;
INSERT INTO ingest_events(event_id,institution_id,installation_id,key_id,aggregate_type,aggregate_id,aggregate_version,event_type,
 schema_version,payload_checksum,payload,request_timestamp,nonce_hash)
SELECT md5(id::text||'-event')::uuid,id,md5(id::text||'-installation')::uuid,md5(id::text||'-key')::uuid,
 'PUBLICATION',md5(id::text||'-source-pub-1')::uuid,1,'OPS02_ISOLATED',1,repeat('a',64),'{}',now(),repeat('b',64) FROM institutions;
INSERT INTO request_nonces(id,key_id,nonce_hash,expires_at)
SELECT md5(id::text||'-nonce')::uuid,md5(id::text||'-key')::uuid,repeat('c',64),now()+interval '1 hour' FROM institutions;
INSERT INTO reconciliation_runs(id,institution_id,installation_id,manifest_checksum,manifest)
SELECT md5(id::text||'-reconcile')::uuid,id,md5(id::text||'-installation')::uuid,repeat('d',64),'{}' FROM institutions;
INSERT INTO central_jobs(id,institution_id,job_type,dedupe_key,payload,state,available_at,updated_at)
SELECT gen_random_uuid(),i.id,'OPS02_NEVER_EXECUTE','ops02-'||i.id||'-'||n,'{}',
 CASE WHEN n%4=0 THEN 'COMPLETED' ELSE 'PENDING' END::central_job_state,
 now()-((n*10)||' minutes')::interval,now()
FROM institutions i CROSS JOIN generate_series(1,20) n;
