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

## Activation record — 2026-11-25

Production main mail center is active. Receiving webhook ID: `4253cc22-2abc-40cc-8f9e-4e22c61d7c65`. Dedicated key name: `Seng Guan Auto mail center production`. Both key values are encrypted Pages secrets; the earlier unused key was revoked.

Root MX is `10 receive-apne1.forge.rmta.net`. Previous primary MX was `33 route1.mx.cloudflare.net`; fallbacks were `53 route2.mx.cloudflare.net` and `75 route3.mx.cloudflare.net`. They have been replaced/removed. Pre-existing info/support/admin forwarding rules were all Disabled, and catch-all was Disabled/Drop. They remain recorded in Cloudflare but no longer handle domain mail. No active custom aliases beyond sales/admin were migrated.

R2 Public Access was checked Disabled before actual receipt. Actual sales/admin self-addressed setup messages reached Resend and the backend inbox. Both default Hotmail recipients showed Delivered for each test, and notification content contained the matching authenticated deep link. Delivered means recipient mail server acceptance, not proof of inbox placement or reading.

Unsigned webhook and unauthenticated settings requests returned 401 in production. Build, server checks, 12 existing API tests and 8 mail tests passed. HTML resource blocking and phone layout were tested with synthetic browser fixtures. Real-attachment handling and a complete logged-out OTP round trip to an inbound deep link have not been tested end to end; the login code preserves the query and unauthorized requests are rejected.

## Inboxes integration — 2026-11-25

User approved native Inboxes including Anthropic classification. Sales/admin native inboxes created on existing verified domain; MX unchanged. Migration0017 adds CC/BCC, per-mailbox notification routes, owner-scoped history. Migration0018 saves native send payload/draft/provider IDs for safe retries. Both migrations applied through D1 console.

Default mail UI uses authenticated native threads, Inbox/Sent/Archive/Spam, oldest-first conversation messages, CC/BCC and native forwarding. New messages/replies use saved provider drafts and stable send keys. Previous mail remains accessible through Previous emails; old deep links preserve archive mode. Historical Emails are not automatically imported into native Inboxes.

The existing signed webhook now subscribes only to inbox.email.received/inbox.email.sent. Legacy email.received handling stays available for manual replay, but the old subscription was removed after attachment recovery to avoid parallel receipt processing. Native events archive private bodies and attachments in D1/R2 and notify inbound only. Notification routes: sales→sengguanauto.app@hotmail.com; admin→sengguanauto.bos@hotmail.com. Links point to native threads. Attachments use independent R2 objects; failed files never hide body or block ready files. Native attachment access validates inbox/thread/email membership and does not depend on backup arrival.

Resend publishes30-day standard data retention. Existing private archive remains; do not remove it as part of native integration. No inbox AI agent configured.

Local verification:20 mail tests,12 vehicle API tests, production build and server typecheck passed. Live deployment and attachment replay validation to be recorded after rollout.

Live verification: main3064c0c deployed successfully (db45bd2d-8dea-4d7a-a35f-dd1a2c55dcd9). Native sales→admin message and admin reply succeeded in one conversation; follow-up recipient remained correct. CC address history selection verified. Failed legacy attachment event msg_3MasVrtowLLSLHOQSocKmPEWEbH replayed with200; IMG_20261125_171251.jpg downloaded successfully. Both native inbox events showed200.
