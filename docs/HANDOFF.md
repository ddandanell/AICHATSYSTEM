# Handoff

Read the store handoff first. This file is the short copy that lives in the repo.

Store handoff: `/cursor/stores/bc-5928a827-61d1-4e52-9e4b-2d10bbb58416/docs/handoff.md`

Also open:

- Roadmap (do not start phases 3–5): `/cursor/stores/bc-5928a827-61d1-4e52-9e4b-2d10bbb58416/docs/roadmap.md`
- Inbox UX: `/cursor/stores/bc-5928a827-61d1-4e52-9e4b-2d10bbb58416/docs/inbox-ux.md`
- CBLS: `/cursor/stores/bc-5928a827-61d1-4e52-9e4b-2d10bbb58416/docs/cbls-architecture.md`
- Notes: `/cursor/stores/bc-5928a827-61d1-4e52-9e4b-2d10bbb58416/notes.md`

## Branch and data

- Branch: `cursor/decision-ledger-console-d800`
- Dev server: `http://127.0.0.1:4317`
- Schema: Neon `mychef_inbox` (database `mychef`, role `mychef_runtime`)
- Connection string: `DATABASE_URL` in gitignored `.env.local` only
- **No auto-send.** Auto-pilot default off.
- Mac steps: [LOCAL.md](../LOCAL.md). Required env names: `DATABASE_URL`, `KEY_READER_DATABASE_URL`, `AUTH_SECRET`, `BYOK_ENCRYPTION_KEY`. Optional: `CRON_SECRET`, `GHL_WEBHOOK_SECRET`. Values stay out of git.
- Vercel: `vercel.json` cron only. Deploy branch `cursor/decision-ledger-console-d800`.

## Settings already accepted

- Keys: `/mychef/settings/keys` — Vercel AI Gateway and DeepSeek first. Server-side ciphertext, four-character hint in the UI. Does not send.
- Auto-pilot: `/mychef/settings/autopilot` — switch default off, confidence threshold on `integration_connections.id = autopilot`. A candidate mark does not send.

## What not to rebuild here

Inbox UI, the learning queue, and the welcome login screen have their own branches (`cursor/inbox-three-pane-ui`, `cursor/learning-queue-cbls`, `cursor/welcome-login-keys`). This branch keeps Neon wiring, dashboard metrics, the GHL receive stub, the import page, keys, and the autopilot switch.

Phases 3–5 (menu engine, business intelligence, full autopilot) stay queued.
