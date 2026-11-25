CREATE TABLE mail_signatures (mailbox TEXT PRIMARY KEY, signature TEXT NOT NULL DEFAULT '');
INSERT INTO mail_signatures(mailbox) VALUES('sales@sengguanauto.com.my'),('admin@sengguanauto.com.my');
