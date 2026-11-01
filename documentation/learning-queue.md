# Learning Queue — operator notes

Shipped on branch `cursor/learning-queue-cbls`. Spec: [cbls-architecture.md](./cbls-architecture.md). Handoff: [handoff.md](./handoff.md).

## What you do

1. Review drafts in the inbox and record a reason when you edit.
2. Open **Learning** (`/mychef/candidates`) or wait for the nightly cron (02:00 Asia/Kuala_Lumpur).
3. Cards group by **Missing Knowledge**, **Tone**, **Outdated**, **Suggested**, each with an AI vs human evidence diff.
4. **Approve Snippet** embeds the case as `situational` knowledge for later retrieval.
5. **Dismiss** retires the proposal.
6. The curated library (12 knowledge rows) is never overwritten. Nothing auto-activates. Nothing is sent.

## How it runs

| Trigger | Path |
|--------|------|
| Manual | **Run learning pass** on the Learning page |
| Cron | `GET /api/cron/learn` with `Authorization: Bearer $CRON_SECRET` (`vercel.json` schedule `0 18 * * *` UTC) |

Idempotency: each clustered decision gets `audit_log.action = learn:processed`. Re-runs skip those ids. No new columns or DDL.

Knowledge-gap reasons (`missing_knowledge`, `wrong_policy`, `wrong_fact`) → pending `learning-pass` rows. Other reasons → pending `ledger-rule` rows.

## Out of scope for this slice

3-pane inbox rebuild, welcome login, provider wiring, GHL send, WhatsApp, tag-scoped retrieval polish, and auto-pilot acceptance. Those stay on other branches / later work.
