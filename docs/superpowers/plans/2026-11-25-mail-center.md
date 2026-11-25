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
- [ ] Add failing tests in prototype/tests/mail.test.ts for webhook signature, mailbox validation, duplicate delivery and notifications.
- [ ] Add migration 0016_mail_center.sql for messages, settings and notification tasks.
- [ ] Implement prototype/server/mail.ts with signed webhook, private storage, authenticated settings/list/detail/attachment/send/retry endpoints.
- [ ] Integrate routing and environment declarations.
- [ ] Run pnpm check:server and mail tests.

## Task 2: Admin interface
- [ ] Add AdminMail.tsx/css with mailbox/folder selection, pagination, detail, plain-text compose/reply and notification settings.
- [ ] Route /admin?section=mail through AdminLogin and retain query string on login.
- [ ] Add vehicle-admin/mail navigation and localized labels.
- [ ] Run pnpm build and existing API tests, then inspect responsive UI.

## Task 3: Activation
- [ ] Confirm Resend sending domain and receiving settings; use dedicated server API key/webhook secret.
- [ ] Apply D1 migration, set production secrets, deploy main, configure webhook.
- [ ] Verify signed receipt/notification/deep-link flow before replacing Cloudflare routing MX.
- [ ] Confirm sales/admin external round trips and both Hotmail notifications; record any access blocker without claiming activation.
