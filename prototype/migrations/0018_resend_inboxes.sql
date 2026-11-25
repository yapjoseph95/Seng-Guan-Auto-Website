CREATE TABLE mail_native_sends (
 id TEXT PRIMARY KEY,
 payload TEXT NOT NULL,
 created_at TEXT NOT NULL,
 draft_id TEXT,
 provider_id TEXT
);
