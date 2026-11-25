ALTER TABLE mail_messages ADD COLUMN cc TEXT NOT NULL DEFAULT '[]';
ALTER TABLE mail_messages ADD COLUMN bcc TEXT NOT NULL DEFAULT '[]';
ALTER TABLE mail_settings ADD COLUMN routes TEXT NOT NULL DEFAULT '{"sales@sengguanauto.com.my":["sengguanauto.app@hotmail.com"],"admin@sengguanauto.com.my":["sengguanauto.bos@hotmail.com"]}';
CREATE TABLE mail_history (
 owner TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('address','subject')),
 value TEXT NOT NULL,
 used_at TEXT NOT NULL,
 PRIMARY KEY(owner,kind,value)
);
