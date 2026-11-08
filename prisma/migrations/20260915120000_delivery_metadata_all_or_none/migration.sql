-- CHECK expressions that evaluate to NULL are accepted by PostgreSQL. The
-- original media_delivery_complete check validates values but can allow partial
-- NULL delivery metadata before READY. Preserve that historical check and add
-- an explicit all-or-none invariant for every state.
--
-- Preflight before applying to an existing environment:
-- SELECT count(*) FROM media_objects
-- WHERE num_nonnulls(delivery_object_key, delivery_mime, delivery_sha256,
--                   delivery_size_bytes, delivery_width, delivery_height)
--       NOT IN (0, 6);
-- Do not repair business rows automatically. Validation intentionally fails if
-- existing partial metadata requires operator review. ADD CHECK needs a brief
-- table lock; VALIDATE scans existing rows. Schedule against actual table size.
ALTER TABLE media_objects
  ADD CONSTRAINT media_delivery_all_or_none
  CHECK (num_nonnulls(delivery_object_key, delivery_mime, delivery_sha256,
                     delivery_size_bytes, delivery_width, delivery_height) IN (0, 6))
  NOT VALID;

ALTER TABLE media_objects VALIDATE CONSTRAINT media_delivery_all_or_none;
