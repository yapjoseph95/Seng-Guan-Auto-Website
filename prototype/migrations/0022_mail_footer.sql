ALTER TABLE mail_branding ADD COLUMN footer_html TEXT NOT NULL DEFAULT '';
ALTER TABLE mail_branding ADD COLUMN footer_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE mail_branding ADD COLUMN footer_text TEXT NOT NULL DEFAULT '';
