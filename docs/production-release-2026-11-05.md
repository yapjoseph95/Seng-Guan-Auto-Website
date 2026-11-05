# Production release — 2026-11-05

Release branch: production-2026-11-05. Based on reviewed commit f7ab043a9fabb59d9f43fc8c10a80a7ca955545e.

## Original site backup

- GitHub branch: backup/original-live-2026-11-05
- Original live source: 3b2242951b3a8675d65b0a44588ac49ca9334fae (main is retained)
- Original Cloudflare deployment: f0c231f9-a72f-4187-9020-d184d3645026
- Original deployment URL: https://f0c231f9.seng-guan-auto-website.pages.dev
- Local backup: /Users/josephyap/Documents/ChatGPT/Backups/Seng-Guan-Auto/2026-11-05-before-review-launch
- The local archive contains complete Git history, original source including all pages/assets, review source, and pre-launch Cloudflare/DNS configuration.

## Deployment

Retain the existing seng-guan-auto-website Pages project and custom domains. Set production_branch to production-2026-11-05, build root /prototype, command pnpm build, output dist. The separate review project remains on seng-guan-auto-client-review.

The official build hides the design selector, uses clean public page links, preserves legacy .html URLs, removes review copy, and retains the site's existing security headers. VITE_OFFICIAL_SITE=true is defined in prototype/.env.production on this branch only.

## Restore

Restore the Pages project production branch to main (or backup/original-live-2026-11-05) and restore its build configuration to empty build command/root/output. Trigger a Git deployment, or roll back to the preserved production deployment f0c231f9-a72f-4187-9020-d184d3645026. No DNS change is required. The original full configuration is stored in cloudflare-before-launch.json locally.
