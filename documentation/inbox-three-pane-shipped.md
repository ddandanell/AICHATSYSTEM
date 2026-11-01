# Three-pane inbox — shipped

Branch: `cursor/inbox-three-pane-ui`  
Milestone: CBLS / inbox-ux **Phase 1 only** (3-pane desk). Phase 3–5 (nightly cluster polish, learning-queue productization, auto-pilot) deferred.

## What landed

- Full-height desk at `/mychef/inbox` and `/mychef/inbox/[id]` when `DATABASE_URL` is `mychef_runtime`.
- Pane 1 queue filters, cards, J/K.
- Pane 2 history + editable draft + approve / regenerate / escalate (ledger only; banner: sending not connected).
- Pane 3 Client Info + AI Brain; tag save re-drafts; edit opens why + remember → pending `situational` knowledge row.
- Channel seam `src/lib/channels.ts` reserves WhatsApp Business; not implemented.
- README “Inbox desk” section; file headers on inbox UI modules point at `inbox-ux.md` and `handoff.md`.

## Not in this push

Nightly learning cron product UX, learning-queue approve/dismiss redesign, dual-language / BI boards, WhatsApp, controlled login password allowlist, auto-send.
