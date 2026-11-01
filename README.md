# Inbox mychef

Review drafted client replies and record why a reply was right or wrong. The console is a decision ledger, a key vault, and a review queue. It is not a chat window, and it does not send messages.

**Docs:** [documentation/](./documentation/) · **GitHub:** [numini-co/inbox-mychef](https://github.com/numini-co/inbox-mychef)

Each workspace is a tenant. Postgres row-level security is the boundary. Provider keys stay on the server, encrypted with AES-256-GCM. The browser only ever sees a four-character hint.

## Database

The console reads `DATABASE_URL` and `KEY_READER_DATABASE_URL`. Local Docker uses `inbox_app` and `inbox_key_reader`. The Neon project `mychef` is opened as `mychef_runtime`. That role cannot create schemas, tables, or extensions, and it does not own the existing tables, so the ledger is not copied into new `documents` or `chunks` tables. The console reads and writes `mychef_inbox` in place: knowledge, contacts, conversations, messages, drafts, feedback, decision records, audit log, and provider rows on `integration_connections`. Existing knowledge rows stay in `mychef_inbox.knowledge`. No source table is dropped. Put the Neon connection string only in `.env.local`. Do not commit it.

`npm run db:migrate` skips `002_roles.sql` when the current user cannot create roles. `npm run verify:rls` expects the local Harbor Kitchen and Northline Catering seed. Point it at Docker, not Neon.

On Neon, a signed-in session is the owner of the `mychef` workspace. The inbox is the conversations that still need a reply. Automatic sending is not on.

## Run locally

Postgres runs from Docker. The app role is not a superuser and does not own the tables, so row-level security applies.

```bash
docker compose up -d
cp .env.example .env.local
npm install
npm run db:setup
npm run dev
```

Open [http://127.0.0.1:4327](http://127.0.0.1:4327).

Agent handoff (architecture, Neon rules, channel adapters): `/cursor/stores/bc-5928a827-61d1-4e52-9e4b-2d10bbb58416/docs/handoff.md`.

### Local Docker sessions

- Maya Chen (`maya@harbor-kitchen.example`) — owner of Harbor Kitchen. Two drafts are waiting. The reviewed tab is empty.
- Jonah Hale (`jonah@northline.example`) — owner of Northline Catering. The pending queue is empty. One edited reply is already reviewed.

### Neon (mychef_runtime)

Only approved operators sign in. Seed the owner with `npm run seed:operator` after setting `OPERATOR_BOOTSTRAP_*` in gitignored `.env.local`. The approved owner email is `bali@mychef.id`. Passwords are stored as scrypt hashes on `integration_connections` (`id = operator:<email>`). Manage operators at `/mychef/settings/access`. After login you land on the dashboard with next steps for Inbox, Knowledge, and Keys.

## Auth

On Neon, Auth.js credentials require an approved operator email and password. Hashed passwords only — never log or commit plaintext. Local Docker keeps the email-only fallback for Harbor Kitchen / Northline demos. Clerk Organizations remain optional (`CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`).

Optional Google sign-in uses `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` (disabled for Neon operator mode).

The session resolves the workspace from the URL (`/[workspace]/...`). Client `x-tenant-*` headers are stripped and never trusted.

## Keys

`BYOK_ENCRYPTION_KEY` is a 32-byte key, base64-encoded. The values in `.env.example` are for local development. Replace them before storing a real provider key. Prefer **Vercel AI Gateway** and **DeepSeek** first, then OpenAI, Anthropic, Google, Azure, and Bedrock. Keys are AES-256-GCM encrypted; the UI shows a four-character hint only. Operator password hashes never appear on the Keys page.

A connection test calls the provider from the server. If no active key is stored, the result is `No active key stored for this provider.` The test does not invent a completion. Azure OpenAI and Bedrock need an endpoint or signing setup this slice does not store, so those tests refuse to send the key.

## Auto-pilot

Off by default at `/mychef/settings/autopilot`. Turning it on can only record an `auto_sent_candidate` decision. Sending is not connected.

## Channels

Inbound adapters live under `src/channels/inbound.ts`. GoHighLevel is wired today. WhatsApp Business is reserved as a later channel (`whatsappInboundReady = false`) and must reuse the same conversation → draft → review loop. Do not build WhatsApp send yet.

## Isolation check

```bash
npm run verify:rls
```

The check signs Maya and Jonah into their own workspaces, then reads `decision_records` and `chunks` with each org id set via `set_config('app.current_org_id', ..., true)`. A session scoped to one workspace cannot read the other's decision rows or chunks, including a lookup by the other workspace's id. Retrieval for a Harbor draft does not return Northline chunk ids, and the reverse. With no org id set, the app role sees nothing. The migration superuser can see both, which is how you know the rows exist. The same check tries to insert a chunk whose `org_id` and `document_id` belong to different workspaces. The composite foreign key rejects it.

## Retrieval

Positions and playbooks under `knowledge/` are ingested into `documents` and `chunks` once per seeded workspace, along with each workspace's own decision text. Embeddings are a local 256-dimension hash. No provider is called. On a decision, the page shows similar past decisions and matching knowledge from that workspace only. `documents` and `chunks` use the same forced row-level security policy as the ledger. A chunk can reference a document only when both rows share `org_id`.

## Inbox desk (myCHEF)

On Neon (`mychef_runtime`), `/mychef/inbox` is a full-height **three-pane operations desk** (see agent-store `docs/inbox-ux.md` and `docs/handoff.md`):

1. **Queue** — search; filters All / Needs Review / Auto-Sent / Escalated; cards with name, snippet, time, category badges (Private Chef / Catering / VIP), confidence dot.
2. **Workspace** — response clock (Started / Waiting / averages / Last activity), chat history, sticky AI suggested reply, Approve / Regenerate / Escalate / How it came to this. Approve writes the ledger only; **sending is not connected** (no GHL or WhatsApp send). Edit → Why tab → Remember queues a pending situational case.
3. **Context** — Client Info (phone/email/address/tags; saving tags regenerates the draft) and Why / AI Brain (sources, reasoning, correct→learn form). On mobile this is a sheet, not a third column.

Shortcuts: `J`/`K` queue, `A` approve, `E` edit, `⌘`/`Ctrl`+Enter submit. Mobile: list → detail → context sheet.

Channel kinds are reserved in `src/lib/channels.ts` (`ghl`, `whatsapp_business` planned, `manual`). WhatsApp Business is not built in this slice.

Local Docker Harbor/Northline tenants still use the older card queue and paste-to-draft flow.

## Draft copilot

On the pending inbox (local Docker), a reviewer pastes one client message. Inside that workspace’s row-level security scope, the server loads matching knowledge chunks and similar decisions, then writes a `decision_records` row with status `pending_review`. The row stores draft text, why, why not, confidence, source refs, and whether to escalate. Nothing is sent.

On myCHEF, drafts are created from the desk or the GHL receive stub against `mychef_inbox` knowledge. If no provider key is stored, the draft is deterministic: it quotes the closest position and says it was not produced by a provider. The draft path does not call a provider.

## Import

A signed-in reviewer uploads a ChatGPT project export (`.zip`, `.json`, or `.markdown`) at `/mychef/import`. The file is kept as a raw archive under `data/raw/mychef` for that workspace. That directory is local and is not committed. There is no bytea archive table in `mychef_inbox`, so the bytes are not written into knowledge or webhook receipts. Approving an archive inserts a new pending knowledge row with source `import:<id>`. Existing knowledge rows are not updated.

## GoHighLevel receive stub

`POST /api/webhooks/ghl` accepts a JSON message. If `GHL_WEBHOOK_SECRET` is set, the request must send the same value in `x-ghl-secret` or `Authorization: Bearer`. A message body creates or updates a conversation and a pending local draft. The route never calls a send API. A body that does not fit the inbox tables is written to `webhook_receipts` and listed at `/mychef/settings/webhooks`. Automatic sending stays off.

## What this slice does not do

No GoHighLevel send, no MCP, and no automatic send. The receive stub only stores an inbound message and a pending draft.
