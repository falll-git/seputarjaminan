CREATE TABLE ops_auth_challenges (
  id UUID NOT NULL,
  ops_user_id UUID NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at TIMESTAMPTZ(3) NOT NULL,
  consumed_at TIMESTAMPTZ(3),
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT ops_auth_challenges_pkey PRIMARY KEY (id),
  CONSTRAINT ops_auth_challenges_ops_user_id_fkey
    FOREIGN KEY (ops_user_id) REFERENCES ops_users(id)
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX ops_auth_challenges_token_hash_key ON ops_auth_challenges(token_hash);
CREATE INDEX ops_auth_challenges_ops_user_id_expires_at_idx ON ops_auth_challenges(ops_user_id, expires_at);

ALTER TABLE ops_auth_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE ops_auth_challenges FORCE ROW LEVEL SECURITY;
CREATE POLICY ops_auth_challenges_policy ON ops_auth_challenges FOR ALL TO PUBLIC
  USING (sj_has_database_role('sj_ops'))
  WITH CHECK (sj_has_database_role('sj_ops'));

GRANT SELECT, INSERT, UPDATE, DELETE ON ops_auth_challenges TO sj_ops;
