-- The worker deletes expired request nonces. The nonce RLS policy resolves the
-- owning institution through institution_keys, so PostgreSQL must allow the
-- policy expression to read exactly those two columns. No key state, public
-- key material, installation metadata, or write privilege is exposed.
GRANT SELECT (key_id, institution_id) ON institution_keys TO sj_worker;
