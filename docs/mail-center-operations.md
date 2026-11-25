# Mail center operations

Entry: `/admin?section=mail`. A notification opens `/admin?section=mail&message=<id>`; the existing AdminLogin preserves this URL through OTP sign-in. Every administrator in ADMIN_EMAILS can access both mailboxes.

## Production configuration

- Pages secrets: `RESEND_API_KEY` (dedicated Full access key), `RESEND_WEBHOOK_SECRET` (webhook signing secret). Never put either in frontend variables, source or logs.
- Resend webhook: `https://sengguanauto.com.my/api/mail-webhook`, event `email.received` only.
- Apply `prototype/migrations/0016_mail_center.sql` before exposing the UI. This migration adds only independent mail tables. On 2026-11-25 it was applied through the Cloudflare D1 console and the three tables plus index were verified there (existing database has no Wrangler migration history).
- Verify both company mailboxes via a signed webhook/test inbox before switching root-domain MX. Obtain exact MX from Resend's verified domain. Export/record old Email Routing rules and confirm any other active company aliases before changing root-domain receipt.
- Public Pages preview domains must not receive production webhooks. Notification links always use the canonical HTTPS site.

## Stored data and retries

D1: `mail_messages`, `mail_settings`, `mail_notifications`. R2 objects use the private `mail/` prefix in the existing PHOTOS binding and are served only by authenticated mail endpoints. Preserve this prefix in any photo cleanup/lifecycle scripts.

Default notifications: enabled, both `sengguanauto.app@hotmail.com` and `sengguanauto.bos@hotmail.com` for every new inbound email. Settings edits affect future arrivals, not already-created delivery tasks. Company-domain notification recipients are rejected to prevent loops.

Webhook retries first check the incoming provider ID. Existing mail is not fetched/stored again; only unsent notification tasks are retried. A provider failure returns an error for Resend retry. A pending notice can also be retried from its mail detail. After 23 hours from a first notification attempt, check Resend delivery logs before attempting manual remediation; idempotency expires after 24 hours. The service deliberately blocks automatic older retries to avoid duplicates. Resend webhook retries are finite: monitor failed deliveries in its dashboard.

Outgoing mail stores its body privately before sending and uses one client-generated UUID as a stable idempotency key. Provider acceptance is shown as sent, not guaranteed delivered. A failed/ambiguous send remains pending; inspect Resend before creating a new email with a new identifier. Reloading a pending message does not automatically send it.

First version sends plain-text messages to one recipient, displays received HTML in a sanitized sandbox and supports received-attachment download. It does not provide outbound attachments, CC/BCC, drafts across devices, deletion, search, scheduled delivery, or bounce tracking. No automatic retention/deletion applies to stored mail.

## Verification

`pnpm build`, `pnpm check:server`, `pnpm test:api`, `pnpm test:mail`.

Manual checks: phone/desktop mail layout; reply sender/recipient; notification settings; unauthorized detail/attachment rejection; signed webhook and repeated delivery; failed second notification followed by retry; external round-trip with both sales/admin; notification deep link when signed in and after OTP. Local browser fixture confirmed sanitizer output made zero tracking-image/iframe requests. Fixtures contain synthetic data and are removed before commit.
