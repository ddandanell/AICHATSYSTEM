# Inbox mychef

Review drafted client replies and record why a reply was right or wrong. The console is a decision ledger, a key vault, and a review queue. It is not a chat window, and it does not send messages.

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

Open [http://127.0.0.1:4317](http://127.0.0.1:4317).

Seeded sessions on local Docker:

- Maya Chen (`maya@harbor-kitchen.example`) — owner of Harbor Kitchen. Two drafts are waiting. The reviewed tab is empty.
- Jonah Hale (`jonah@northline.example`) — owner of Northline Catering. The pending queue is empty. One edited reply is already reviewed.

When the console points at Neon, the same Maya account is the owner of myCHEF. Jonah has no membership there. The myCHEF inbox starts empty; the knowledge page lists the copied documents.

A new email creates a user and lands on workspace setup. Create a workspace to see an empty queue, or join a slug as a viewer. This fallback stores no password.

## Auth

Production auth is Clerk Organizations (`CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`) with roles owner, admin, reviewer, and viewer. When those keys are absent, Auth.js credentials sign-in is the local fallback and still writes real user and organization ids.

Optional Google sign-in uses `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`.

The session resolves the workspace from the URL (`/[workspace]/...`). Client `x-tenant-*` headers are stripped and never trusted.

## Keys

`BYOK_ENCRYPTION_KEY` is a 32-byte key, base64-encoded. The values in `.env.example` are for local development. Replace them before storing a real provider key.

Vercel AI Gateway and DeepSeek are the first keys on `/mychef/settings/keys`. Gateway defaults to `https://ai-gateway.vercel.sh/v1`. DeepSeek uses `https://api.deepseek.com`. A saved key is shown only as a four-character hint. A connection test calls the provider from the server. If no active key is stored, the result is `No active key stored for this provider.` The test does not invent a completion. Azure OpenAI and Bedrock need an endpoint or signing setup this slice does not store, so those tests refuse to send the key.

The home dashboard lists waiting reviews, acceptance rate, escalations, and model spend. Spend stays `$0` because this console does not meter a provider call. Drafts stay local until a key is stored, and storing a key still does not send a guest reply.

## Isolation check

```bash
npm run verify:rls
```

The check signs Maya and Jonah into their own workspaces, then reads `decision_records` and `chunks` with each org id set via `set_config('app.current_org_id', ..., true)`. A session scoped to one workspace cannot read the other's decision rows or chunks, including a lookup by the other workspace's id. Retrieval for a Harbor draft does not return Northline chunk ids, and the reverse. With no org id set, the app role sees nothing. The migration superuser can see both, which is how you know the rows exist. The same check tries to insert a chunk whose `org_id` and `document_id` belong to different workspaces. The composite foreign key rejects it.

## Retrieval

Positions and playbooks under `knowledge/` are ingested into `documents` and `chunks` once per seeded workspace, along with each workspace's own decision text. Embeddings are a local 256-dimension hash. No provider is called. On a decision, the page shows similar past decisions and matching knowledge from that workspace only. `documents` and `chunks` use the same forced row-level security policy as the ledger. A chunk can reference a document only when both rows share `org_id`.

## Draft copilot

On the pending inbox, a reviewer pastes one client message. Inside that workspace’s row-level security scope, the server loads matching knowledge chunks and similar decisions, then writes a `decision_records` row with status `pending_review`. The row stores draft text, why, why not, confidence, source refs, and whether to escalate. Nothing is sent.

If no provider key is stored, the draft is deterministic: it quotes the closest position and says it was not produced by a provider. The draft path does not call a provider.

## Import

A signed-in reviewer uploads a ChatGPT project export (`.zip`, `.json`, or `.markdown`) at `/mychef/import`. The file is kept as a raw archive under `data/raw/mychef` for that workspace. That directory is local and is not committed. There is no bytea archive table in `mychef_inbox`, so the bytes are not written into knowledge or webhook receipts. Approving an archive inserts a new pending knowledge row with source `import:<id>`. Existing knowledge rows are not updated.

## GoHighLevel receive stub

`POST /api/webhooks/ghl` accepts a JSON message. If `GHL_WEBHOOK_SECRET` is set, the request must send the same value in `x-ghl-secret` or `Authorization: Bearer`. A message body creates or updates a conversation and a pending local draft. The route never calls a send API. A body that does not fit the inbox tables is written to `webhook_receipts` and listed at `/mychef/settings/webhooks`. Automatic sending stays off.

## Learning pass

On the dashboard, Run learning pass clusters decision records from the last 30 days by reason. Proposals show up in the learning queue. Knowledge-gap reasons become pending `learning-pass` rows. Other reasons become pending `ledger-rule` rows. `good_as_drafted` is skipped. Approved and retired rows are not changed. `GET /api/cron/learn` runs the same pass when `Authorization: Bearer` matches `CRON_SECRET`. Vercel Cron calls that path daily at 02:00 Kuala Lumpur (18:00 UTC). The pass does not activate rules and does not send.

## Auto-pilot

Auto-pilot is off until a workspace owner turns it on at `/mychef/settings/autopilot`. The switch and confidence threshold are stored on a separate `integration_connections` row named `autopilot`. Existing provider and GoHighLevel rows are not updated. While the switch is off, every draft stays pending. While it is on, a draft whose confidence meets the threshold and does not need a person is recorded as `auto_sent_candidate`. The banner says sending is not connected. No send call is made.

## What this slice does not do

No GoHighLevel send, no MCP, and no automatic send. The receive stub only stores an inbound message and a pending draft.
