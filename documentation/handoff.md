# MyChef handoff — read this first

If you are a new agent joining Inbox mychef / MyChef, start here. Then open the linked docs and `notes.md`.

## What this project is

A **Digital Sous Chef** operations console: draft replies to client messages, capture why a human accepted/edited/rejected, learn via situational case snippets, automate only later. Not a chatbot wrapper.

Mental model: LLM = reasoning, GHL (later WhatsApp) = channel adapters, MCP/tools = hands, durable assets = decision ledger + curated knowledge + evals.

## Where things live

| Path | Purpose |
|------|---------|
| [Project Notes](cursor.agent://project/notes) `/cursor/stores/bc-5928a827-61d1-4e52-9e4b-2d10bbb58416/notes.md` | Live task tracker (IMC-*) |
| `/cursor/stores/bc-5928a827-61d1-4e52-9e4b-2d10bbb58416/preferences.md` | Lasting product preferences |
| `/cursor/stores/bc-5928a827-61d1-4e52-9e4b-2d10bbb58416/docs/todo.md` | Near-term ordered steps |
| `/cursor/stores/bc-5928a827-61d1-4e52-9e4b-2d10bbb58416/docs/roadmap.md` | Master phases 1–5 (3–5 not started) |
| `/cursor/stores/bc-5928a827-61d1-4e52-9e4b-2d10bbb58416/docs/agent-spec.md` | DDL, RLS, reason codes, learning loop |
| `/cursor/stores/bc-5928a827-61d1-4e52-9e4b-2d10bbb58416/docs/technical-blueprint.md` | Stack, BYOK, multi-tenant |
| `/cursor/stores/bc-5928a827-61d1-4e52-9e4b-2d10bbb58416/docs/architecture.md` | Original four-store foundation |
| `/cursor/stores/bc-5928a827-61d1-4e52-9e4b-2d10bbb58416/docs/inbox-ux.md` | 3-pane inbox UX |
| `/cursor/stores/bc-5928a827-61d1-4e52-9e4b-2d10bbb58416/docs/contact-response-desk.md` | Contact open: timers, always-on AI draft, correct→learn |
| `/cursor/stores/bc-5928a827-61d1-4e52-9e4b-2d10bbb58416/docs/inbox-design-system.md` | Strict shadcn three-pane desk contract + agent prompt |
| `/cursor/stores/bc-5928a827-61d1-4e52-9e4b-2d10bbb58416/docs/cbls-architecture.md` | Case-Based Learning System |
| `/cursor/stores/bc-5928a827-61d1-4e52-9e4b-2d10bbb58416/docs/learning-queue.md` | Learning Queue operator notes (shipped) |
| This file | Agent handoff |

## Code and branches (worker VMs)

Primary agent: `bc-39d8efad-3cd6-5f36-b9c7-7e050c1cd800` Decision ledger console. Branch: `cursor/decision-ledger-console-d800`. Dev server often at `http://127.0.0.1:4317`. Turns may be cancelled when the coordinator forks; check GetAgentStatus before assuming idle.

Parallel forks (may have their own branches; some turns have ERROR’d and been retried):

- `bc-e2dc9f64-6f4f-54e5-abd6-6b250f73edba` Inbox three-pane → `cursor/inbox-three-pane-ui`
- `bc-359fc7af-08fc-549d-b955-a334a34a2566` Learning queue → `cursor/learning-queue-cbls` (queue types, AI/human diff, Approve→situational / Dismiss, cron+manual, no auto-send)
- `bc-d2dac56d-7c60-509e-94a1-40ce0f771ec3` Welcome login and keys → `cursor/welcome-login-keys`

Repo is an agent_temp Origin checkout; PR creation via ManagePullRequest may fail. Push branches anyway. Do not commit secrets.

## Database (Neon mychef)

- Host pattern: `ep-bitter-fire-azf4encj` ap-southeast-1, database `mychef`.
- App role: `mychef_runtime` — **not** owner; cannot CREATE TABLE / CREATE EXTENSION. Schema changes need `mychef_owner` connection string from the user.
- Schema in use: `mychef_inbox` (not public).
- Important counts when last inventoried: 1 workspace (`mychef` / myCHEF), 12 knowledge, 782 contacts, 784 conversations (~115 needs_reply), 12343 messages, decision_records/feedback often empty until reviews happen.
- Console should filter by `workspace_id` for that workspace. Forced RLS from agent-spec could not be installed without owner rights.
- Connection string belongs only in gitignored `.env.local` (DATABASE_URL). Never commit it.
- Neon Auth URLs exist separately (auth + JWKS); those are not the Postgres URL.

## Hard product rules

1. Human review first; auto-send last and default OFF.
2. Do not dump raw chats into a vector DB as “knowledge.”
3. Do not let the model rewrite rules without human approval.
4. Provider keys: server-side encryption only; UI shows last-4 hint.
5. Channels are adapters (GHL now; WhatsApp Business later — design for pluggable inbound/outbound, do not build WhatsApp yet).
6. Run fully automatic between steps; stop only for missing secrets or destructive DB choices.
7. Approved console owner email: `bali@mychef.id` (password seeded hashed — never log plaintext).
8. Prefer Vercel AI Gateway and DeepSeek keys first among BYOK providers.

## Done so far (high level)

- Multi-tenant decision ledger prototype, then pivoted onto live Neon `mychef_inbox`.
- Inbox listing needs_reply, knowledge list (12 rows), draft copilot (local drafter if no key), feedback → decision_records/feedback.
- Import page for ChatGPT exports (raw under gitignored `data/raw/mychef`; approve creates new pending knowledge, does not overwrite 12).
- GHL webhook receive stub: creates conversation/message/draft, never sends.
- **Learning Queue (CBLS) shipped on `cursor/learning-queue-cbls`:** typed queue (Missing Knowledge / Tone / Outdated / Suggested), AI vs human evidence diff, Approve → `situational` knowledge / Dismiss → retired, idempotent nightly cron + manual pass (`learn:processed` audit, no DDL), curated 12 untouched, no auto-send. See README Learning Queue section and `internal/learning-queue-cbls.md`.
- Docs: todo, agent-spec, blueprint, inbox UX, CBLS, this handoff.

## Still blocked / next

1. Neon **owner** connection string → create ledger/pgvector tables if still needed; install RLS.
2. ~~Finish 3-pane inbox per inbox-ux.md.~~ Shipped on `cursor/inbox-three-pane-ui` (Phase 1 desk only; see `docs/inbox-three-pane-shipped.md`). Phase 3–5 deferred.
3. ~~Welcome login + keys UI~~ — shipped on `cursor/welcome-login-keys` (scrypt operators, BYOK keys, autopilot OFF). See `internal/welcome-login-keys-ship.md`.
4. Wire real provider draft when key stored.
5. Real GHL send only after explicit approve path + token.
6. WhatsApp adapter later (channel seam in `src/channels/inbound.ts`; `whatsappInboundReady = false`).
7. ChatGPT project bulk import curation.
8. Tag-scoped retrieval / auto-pilot acceptance gate (after Learning Queue is in daily use).

## Codebase comments for workers

Every non-trivial module should start with a short file header: purpose, tables touched, “do not auto-send”, and link to the doc above. Prefer README sections: How to run, Env vars (names only), Architecture pointers to this handoff.

## How to resume in 5 minutes

1. Read this file + notes.md + preferences.md.
2. Attach to worker desktop or pull latest `cursor/decision-ledger-console-d800`.
3. Confirm `.env.local` has DATABASE_URL (not in git).
4. `npm run dev` on uncommon port; open `/login`.
5. Continue the highest open In Progress row in notes.md.
