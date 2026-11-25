# Resend Inboxes integration

Approved by user on 2026-11-25, including Anthropic automatic classification.

Use Resend native Inboxes for sales/admin conversation threading, read state, folders, replies, forwards and new drafts. Preserve authenticated admin UI, address/subject history and mailbox-specific Hotmail notifications. Preserve existing D1/R2 mail archive and deep links; do not pretend historical Emails are automatically imported into Inboxes. Keep private archive for retention beyond provider limits. No autonomous AI replies.

Alternatives: keep self-built threading (more maintenance), send users to Resend dashboard (separate login), or use native API behind existing admin. User selected the native API.

Implementation: allowlist two mailbox addresses server-side; validate UUID identifiers and all inputs; retain server-only key and signed webhook. Include CC/BCC, forwarding attachments via native endpoint, pagination of conversations and messages. Existing mail stays readable through archive. New mail notifications point to the matching native conversation.
