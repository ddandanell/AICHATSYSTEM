# Inbox mychef — technical blueprint

Multi-tenant by default, provider-agnostic LLM (BYOK), secure by construction. Keys never touch the browser. The database enforces tenant boundaries, not application code.

The console is a key vault, a decision ledger, and a review queue. It is not a chat window.

Critical path: auth + tenant isolation + key storage + one draft flow. Do not build the rest until that works.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js App Router, React, TypeScript |
| Database | PostgreSQL + pgvector |
| ORM | Drizzle (tenant-scoped queries and RLS) |
| UI | Tailwind CSS + shadcn/ui |
| Auth | Clerk Organizations: owner, admin, reviewer, viewer. Auth.js only if Clerk credentials are unavailable; then model User, Organization, Membership, Role in Postgres. |
| Queue | Redis + BullMQ, or Upstash QStash. Not required for the first slice. |
| LLM gateway | Thin server-side proxy now; LiteLLM later. Browser never calls a provider. |
| Observability | Langfuse-shaped traces later. First slice logs `ai_usage_log` rows. |
| Deploy | Vercel + Neon or Supabase + Upstash. Local docker-compose Postgres is the runnable path without cloud credentials. |

## Identity

Two levels: user and workspace (tenant). A user can belong to more than one workspace with different roles.

Login:

1. Sign up (email/password or Google).
2. Create or join a workspace.
3. Session carries `userId`, `orgId`, `orgRole`.
4. Middleware resolves the tenant from the path (`/[workspace]/...` for the first slice; subdomain later). Strip any client-supplied tenant headers. Never trust `x-tenant-*` from the client.
5. `getAuthenticatedContext()` returns `{ userId, orgId, role }`. Every query is scoped by `orgId`.

## BYOK

Keys live only on the server, encrypted at rest, resolved per request.

Envelope encryption:

1. Master key `BYOK_ENCRYPTION_KEY` in server env (vault later).
2. Each workspace key is encrypted and stored as ciphertext.
3. Decrypt in memory only for the request. Never return the full key to the browser. UI shows last-4 hint, created/rotated time, active flag.

```sql
create table provider_credentials (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  provider text not null check (provider in ('openai','anthropic','azure_openai','bedrock','google')),
  encrypted_key bytea not null,
  key_hint text,
  is_active boolean default true,
  created_by uuid,
  created_at timestamptz default now(),
  rotated_at timestamptz,
  unique(org_id, provider)
);
```

No client read of ciphertext. Resolver: `resolveProviderSecret(orgId, provider)` with a 30–60s in-memory cache. A test action makes one minimal provider call through the gateway and returns only success or a safe error.

## RLS

Every tenant table has `org_id`. After auth, `set local app.current_org_id`. Policies use that setting. Application `WHERE org_id` is extra, not the boundary.

Service-role / bypass connection is only for migrations and jobs, never exposed to the browser or to model tools.

## Pages (first slice vs later)

Build now:

- `/login`
- `/onboarding` — create workspace
- `/[workspace]/inbox` — pending drafts
- `/[workspace]/inbox/[id]` — draft, editable final text, feedback form
- `/[workspace]/settings/keys` — add, rotate, revoke, test. Hint only after save.
- `/[workspace]/knowledge` — read position files and playbooks

Later (schema may exist, UI can be a stub): candidates, evals, team, audit.

Feedback form, one step, keyboard submit:

- Decision: Accepted / Edited / Rejected / Escalated
- Reason code dropdown
- Why this reply
- Why not the alternative
- Source chips (mark irrelevant or missing)

Writes `decision_records` and `feedback_events`. Inbound text stays immutable.

## Orchestration (not this slice)

GHL webhook → queue → resolve org → context → RLS retrieval → gateway structured draft → pending decision record → human review → send. Idempotent. Do not build GHL or MCP now.

## Build this slice

1. Next.js, Drizzle, local Postgres (pgvector image), RLS on tenant tables.
2. Auth with a local fallback if Clerk keys are absent: a dev login that creates a user and a workspace, still writing real org ids. Document the Clerk env vars. Do not block the demo on Clerk.
3. Organizations, memberships, provider credentials (encrypted), decision records, feedback events.
4. Inbox review + feedback form + key settings, seeded so empty, pending, and reviewed states are visible.
5. One server action that resolves a key and calls the gateway. If no real provider key is stored, the test returns a clear “no key” result and does not invent a completion.
6. Dev server on an uncommon port, left running. README. Pull request against main.

Do not build the vector ingestion pipeline, GHL, MCP, eval runner, or rule clustering in this slice.
