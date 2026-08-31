-- Vocabulary V1 pinned to @seputarjaminan/contracts 1.0.0.
INSERT INTO public.taxonomy_versions
  (version, checksum, signature, valid_from, active, created_at)
VALUES
  (1, '134d0f3f3264e77d5611f167152a968eace852a27f9df63dc0f7b753f25558e8',
   'BUILTIN_PINNED_CHECKSUM:@seputarjaminan/contracts@1.0.0',
   TIMESTAMP WITH TIME ZONE '2026-08-22 00:00:00+00', true, CURRENT_TIMESTAMP)
ON CONFLICT (version) DO NOTHING;

INSERT INTO public.taxonomy_items
  (id, version, code, parent_code, label_id, required_schema, active)
VALUES
  ('21000000-0000-4000-8000-000000000001',1,'TANAH',NULL,'Tanah','{"required":["land_area_m2"]}'::jsonb,true),
  ('21000000-0000-4000-8000-000000000002',1,'RUMAH','BANGUNAN','Rumah','{"required":["building_area_m2"]}'::jsonb,true),
  ('21000000-0000-4000-8000-000000000003',1,'RUKO','BANGUNAN','Ruko','{"required":["building_area_m2"]}'::jsonb,true),
  ('21000000-0000-4000-8000-000000000004',1,'KIOS','BANGUNAN','Kios','{"required":["building_area_m2"]}'::jsonb,true),
  ('21000000-0000-4000-8000-000000000005',1,'KANTOR','BANGUNAN','Kantor','{"required":["building_area_m2"]}'::jsonb,true),
  ('21000000-0000-4000-8000-000000000006',1,'GUDANG','BANGUNAN','Gudang','{"required":["building_area_m2"]}'::jsonb,true),
  ('21000000-0000-4000-8000-000000000007',1,'PABRIK','BANGUNAN','Pabrik','{"required":["building_area_m2"]}'::jsonb,true),
  ('21000000-0000-4000-8000-000000000008',1,'EXCAVATOR','MESIN_PERALATAN','Excavator','{"required":["model_or_type","public_condition"]}'::jsonb,true),
  ('21000000-0000-4000-8000-000000000009',1,'BULDOSER','MESIN_PERALATAN','Buldoser','{"required":["model_or_type","public_condition"]}'::jsonb,true),
  ('21000000-0000-4000-8000-000000000010',1,'CRANE','MESIN_PERALATAN','Crane','{"required":["model_or_type","public_condition"]}'::jsonb,true),
  ('21000000-0000-4000-8000-000000000011',1,'MESIN_MANUFAKTUR','MESIN_PERALATAN','Mesin manufaktur','{"required":["model_or_type","public_condition"]}'::jsonb,true),
  ('21000000-0000-4000-8000-000000000012',1,'PERALATAN_KONSTRUKSI','MESIN_PERALATAN','Peralatan konstruksi','{"required":["model_or_type","public_condition"]}'::jsonb,true),
  ('21000000-0000-4000-8000-000000000013',1,'PERALATAN_PERTANIAN','MESIN_PERALATAN','Peralatan pertanian','{"required":["model_or_type","public_condition"]}'::jsonb,true),
  ('21000000-0000-4000-8000-000000000014',1,'PERALATAN_MEDIS','MESIN_PERALATAN','Peralatan medis','{"required":["model_or_type","public_condition"]}'::jsonb,true),
  ('21000000-0000-4000-8000-000000000015',1,'MOBIL','KENDARAAN','Mobil','{"required":["brand","model_or_type","public_condition"]}'::jsonb,true),
  ('21000000-0000-4000-8000-000000000016',1,'MOTOR','KENDARAAN','Motor','{"required":["brand","model_or_type","public_condition"]}'::jsonb,true),
  ('21000000-0000-4000-8000-000000000017',1,'TRUK','KENDARAAN','Truk','{"required":["brand","model_or_type","public_condition"]}'::jsonb,true),
  ('21000000-0000-4000-8000-000000000018',1,'BUS','KENDARAAN','Bus','{"required":["brand","model_or_type","public_condition"]}'::jsonb,true)
ON CONFLICT (version, code) DO NOTHING;
