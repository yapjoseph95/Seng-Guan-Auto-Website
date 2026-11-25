CREATE TABLE mail_messages (
 id TEXT PRIMARY KEY,
 direction TEXT NOT NULL CHECK(direction IN ('inbound','outbound')),
 mailbox TEXT NOT NULL,
 sender TEXT NOT NULL,
 recipients TEXT NOT NULL,
 subject TEXT NOT NULL,
 received_at TEXT NOT NULL,
 content_key TEXT NOT NULL,
 read_at TEXT,
 status TEXT NOT NULL DEFAULT 'received',
 reply_id TEXT,
 provider_id TEXT,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX mail_messages_folder ON mail_messages(direction,received_at DESC,id);
CREATE TABLE mail_settings (id INTEGER PRIMARY KEY CHECK(id=1),enabled INTEGER NOT NULL DEFAULT 1,recipients TEXT NOT NULL);
INSERT INTO mail_settings(id,enabled,recipients) VALUES(1,1,'["sengguanauto.app@hotmail.com","sengguanauto.bos@hotmail.com"]');
CREATE TABLE mail_notifications (
 message_id TEXT NOT NULL REFERENCES mail_messages(id),
 recipient TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending',
 first_attempt_at TEXT,
 sent_at TEXT,
 PRIMARY KEY(message_id,recipient)
);
