CREATE TABLE mail_branding (
 mailbox TEXT PRIMARY KEY,
 signature_html TEXT NOT NULL DEFAULT '',
 header_html TEXT NOT NULL DEFAULT '',
 header_enabled INTEGER NOT NULL DEFAULT 0
);
