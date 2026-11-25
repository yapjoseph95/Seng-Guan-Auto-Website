# Mail Center Implementation Plan

> Implement inline using superpowers:executing-plans.

**Goal:** Receive, send and reply as sales/admin with configurable Hotmail notifications and authenticated deep links.
**Architecture:** Pages authenticated mail API, D1 indexes/outbox/settings, private R2 content; signed Resend webhook persists inbound mail and retries notifications. React mail center reuses AdminLogin.
**Tech Stack:** TypeScript, React, D1, R2, Web Crypto, Resend HTTP API.
**Spec:** ../specs/2026-11-25-mail-center-design.md

## Global Constraints
- Keep main and existing vehicle/auth behavior; no new auth system.
- Only sales@sengguanauto.com.my and admin@sengguanauto.com.my may send.
- Default notifications go to both specified Hotmail addresses.
- Do not switch MX until deployed receiving pipeline passes tests.

## Review Focus
- Duplicate webhook deliveries must not duplicate notifications.
- Inbound HTML must not execute scripts or load remote tracking pixels.
- Deep links must survive OTP login without bypassing authorization.
- Resend failures must preserve mail and expose retry state.
- Incoming attachment URLs and filenames must not permit arbitrary fetches or script execution.

## Task 1: Server and storage
- [x] Add failing tests in prototype/tests/mail.test.ts for webhook signature, mailbox validation, duplicate delivery and notifications.
- [x] Add migration 0016_mail_center.sql for messages, settings and notification tasks.
- [x] Implement prototype/server/mail.ts with signed webhook, private storage, authenticated settings/list/detail/attachment/send/retry endpoints.
- [x] Integrate routing and environment declarations.
- [x] Run pnpm check:server and mail tests.

## Task 2: Admin interface
- [x] Add AdminMail.tsx/css with mailbox/folder selection, pagination, detail, plain-text compose/reply and notification settings.
- [x] Route /admin?section=mail through AdminLogin and retain query string on login.
- [x] Add vehicle-admin/mail navigation and localized labels.
- [x] Run pnpm build and existing API tests, then inspect responsive UI.

## Task 3: Activation
- [x] Confirm Resend sending domain and receiving settings; use dedicated server API key/webhook secret.
- [x] Apply D1 migration, set production secrets, deploy main, configure webhook.
- [x] Verify signed receipt/notification/deep-link flow before replacing Cloudflare routing MX.
- [x] Confirm sales/admin external round trips and both Hotmail notifications; record any access blocker without claiming activation.

## Verification record

- 2026-11-25: build + server typecheck passed; vehicle API suite 12/12; mail suite 8/8.
- Independent review: fixed inert HTML parsing, bounded notification idempotency keys, concurrent-send storage consistency.
- Browser fixture: phone-width compose and reply verified; HTML tracking-image/iframe test reported zero resource requests.
- Production D1 mail schema applied via dashboard; R2 public access verified Disabled.
- Dedicated Resend Full access key stored only as production Secret; an unused initial key was revoked with explicit user confirmation. Receiving webhook configured for email.received; signing secret encrypted.
- Production deployed fea253f, then redeployed as 8116155e-2c0c-4ef1-b463-990a0f1fc91f to include signing secret. Unsigned webhook and unauthorized mail API both returned 401.
- Root MX changed to priority 10 receive-apne1.forge.rmta.net. Old priority 53/75 Cloudflare MX removed with user confirmation. Public DNS verified only Resend MX. All three pre-existing Cloudflare aliases were Disabled; no sales alias existed.
- Actual self-addressed sales/admin messages were sent and received, persisted and opened through the mail center. Four Hotmail notifications showed Delivered in Resend; sales notification content pointed to matching stored inbound ID.
- No external human-customer conversation or real attachment was used. Received attachments were implemented but not exercised with a live attachment; initial composition is plain-text with one recipient.
