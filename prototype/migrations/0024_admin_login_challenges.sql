CREATE TABLE admin_login_challenges (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX admin_login_challenges_expiry ON admin_login_challenges(expires_at);
CREATE INDEX admin_login_challenges_email ON admin_login_challenges(email);
