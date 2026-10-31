# Inbox mychef

Review drafted client replies and record why a reply was right or wrong. The console is a decision ledger, a key vault, and a review queue. It is not a chat window, and it does not send messages.

Each workspace is a tenant. Postgres row-level security is the boundary. Provider keys stay on the server, encrypted with AES-256-GCM. The browser only ever sees a four-character hint.

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

Seeded sessions:

- Maya Chen (`maya@harbor-kitchen.example`) — owner of Harbor Kitchen. Two drafts are waiting. The reviewed tab is empty.
- Jonah Hale (`jonah@northline.example`) — owner of Northline Catering. The pending queue is empty. One edited reply is already reviewed.

A new email creates a user and lands on workspace setup. Create a workspace to see an empty queue, or join a slug as a viewer. This fallback stores no password.

## Auth

Production auth is Clerk Organizations (`CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`) with roles owner, admin, reviewer, and viewer. When those keys are absent, Auth.js credentials sign-in is the local fallback and still writes real user and organization ids.

Optional Google sign-in uses `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`.

The session resolves the workspace from the URL (`/[workspace]/...`). Client `x-tenant-*` headers are stripped and never trusted.

## Keys

`BYOK_ENCRYPTION_KEY` is a 32-byte key, base64-encoded. The values in `.env.example` are for local development. Replace them before storing a real provider key.

A connection test calls the provider from the server. If no active key is stored, the result is `No active key stored for this provider.` The test does not invent a completion. Azure OpenAI and Bedrock need an endpoint or signing setup this slice does not store, so those tests refuse to send the key.

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

## What this slice does not do

No GoHighLevel, no MCP, no nightly clustering job, no automatic send, and no eval runner. The nightly learning loop is not implemented. The `rules` table is there so a later job can write `candidate` rows and leave them inactive. Reason codes and the diagnosis rules are fixed in `src/lib/reason-codes.ts` and `src/lib/learning-loop.ts`.
