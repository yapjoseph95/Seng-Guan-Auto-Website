CREATE TABLE mail_saved_drafts (
 id TEXT PRIMARY KEY,
 owner TEXT NOT NULL,
 mailbox TEXT NOT NULL,
 payload TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 deleted_at TEXT
);
CREATE INDEX mail_saved_drafts_owner ON mail_saved_drafts(owner,deleted_at,updated_at DESC);
