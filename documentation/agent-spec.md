# Agent spec — decision ledger, isolation, feedback, learning loop

Hand this to the coding agent. Do not invent columns, reason codes, or policies that contradict it. Infrastructure (Neon, Clerk, Upstash, Langfuse) may be stubbed locally when credentials are absent. The schema and policies are not optional.

## Reason-code taxonomy

Store the code, not the label. Labels are UI copy.

| code | label | meaning |
|---|---|---|
| `wrong_policy` | Wrong policy | Draft contradicts an active position. |
| `wrong_fact` | Wrong fact | Draft states something that is not true. |
| `too_formal` | Too formal | Tone is stiffer than this client needs. |
| `too_casual` | Too casual | Tone is looser than this client needs. |
| `missed_upsell` | Missed upsell | A relevant offer was available and omitted. |
| `should_have_asked` | Should have asked | A disambiguating question was required. |
| `customer_angry` | Customer is angry | Tone or pace ignored the customer's state. |
| `needs_human` | Needs a human | Risk or ambiguity is above the auto threshold. |
| `missing_knowledge` | Missing knowledge | No position covered this case. |
| `irrelevant_source` | Irrelevant source | A cited source should not have been used. |
| `good_as_drafted` | Good as drafted | Accepted with no material change. |

`human_decision` is only `accepted`, `edited`, `rejected`, or `escalated`.

`outcome` (filled later, nullable now): `booked`, `closed`, `refunded`, `no_response`, `complaint`, `ongoing`.

## DDL

```sql
create extension if not exists pgcrypto;
create extension if not exists vector;

create table organizations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

create table users (
  id uuid primary key default gen_random_uuid(),
  external_id text unique,
  email text not null,
  name text,
  created_at timestamptz not null default now()
);

create table memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  user_id uuid not null references users(id),
  role text not null check (role in ('owner','admin','reviewer','viewer')),
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);

create table provider_credentials (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  provider text not null check (provider in ('openai','anthropic','azure_openai','bedrock','google')),
  encrypted_key bytea not null,
  key_hint text,
  is_active boolean not null default true,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  rotated_at timestamptz,
  unique (org_id, provider)
);

create table raw_messages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  conversation_id uuid not null,
  body text not null,
  channel text not null default 'manual',
  received_at timestamptz not null default now()
);

create table decision_records (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  conversation_id uuid not null,
  inbound_message_id uuid not null references raw_messages(id),
  draft_text text not null,
  final_text text,
  action_taken text,
  rationale text,
  why_not text,
  rejected_alternative text,
  reason_code text,
  confidence numeric,
  source_refs jsonb not null default '[]',
  human_decision text check (human_decision in ('accepted','edited','rejected','escalated')),
  status text not null default 'pending_review'
    check (status in ('pending_review','reviewed')),
  outcome text check (outcome in ('booked','closed','refunded','no_response','complaint','ongoing')),
  outcome_at timestamptz,
  created_at timestamptz not null default now()
);

create table feedback_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  decision_record_id uuid not null references decision_records(id),
  actor_id uuid references users(id),
  human_decision text not null check (human_decision in ('accepted','edited','rejected','escalated')),
  reason_code text not null,
  rationale text,
  why_not text,
  source_marks jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table rules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  scope text not null,
  statement text not null,
  priority int not null default 0,
  exceptions jsonb not null default '[]',
  evidence_count int not null default 0,
  owner_id uuid references users(id),
  version int not null default 1,
  status text not null default 'candidate'
    check (status in ('candidate','active','deprecated')),
  created_at timestamptz not null default now()
);

create table eval_cases (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  name text not null,
  inbound_text text not null,
  expected_decision text,
  expected_reason_code text,
  must_include text,
  must_not_include text,
  created_at timestamptz not null default now()
);

create table eval_runs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  eval_case_id uuid not null references eval_cases(id),
  passed boolean not null,
  notes text,
  created_at timestamptz not null default now()
);

create table ai_usage_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  decision_record_id uuid references decision_records(id),
  provider text,
  model text,
  input_tokens int,
  output_tokens int,
  created_at timestamptz not null default now()
);

alter table provider_credentials enable row level security;
alter table provider_credentials force row level security;
alter table raw_messages enable row level security;
alter table raw_messages force row level security;
alter table decision_records enable row level security;
alter table decision_records force row level security;
alter table feedback_events enable row level security;
alter table feedback_events force row level security;
alter table rules enable row level security;
alter table rules force row level security;
alter table eval_cases enable row level security;
alter table eval_cases force row level security;
alter table eval_runs enable row level security;
alter table eval_runs force row level security;
alter table ai_usage_log enable row level security;
alter table ai_usage_log force row level security;

create policy tenant_isolation_provider_credentials on provider_credentials
  using (org_id = nullif(current_setting('app.current_org_id', true), '')::uuid)
  with check (org_id = nullif(current_setting('app.current_org_id', true), '')::uuid);
create policy tenant_isolation_raw_messages on raw_messages
  using (org_id = nullif(current_setting('app.current_org_id', true), '')::uuid)
  with check (org_id = nullif(current_setting('app.current_org_id', true), '')::uuid);
create policy tenant_isolation_decision_records on decision_records
  using (org_id = nullif(current_setting('app.current_org_id', true), '')::uuid)
  with check (org_id = nullif(current_setting('app.current_org_id', true), '')::uuid);
create policy tenant_isolation_feedback_events on feedback_events
  using (org_id = nullif(current_setting('app.current_org_id', true), '')::uuid)
  with check (org_id = nullif(current_setting('app.current_org_id', true), '')::uuid);
create policy tenant_isolation_rules on rules
  using (org_id = nullif(current_setting('app.current_org_id', true), '')::uuid)
  with check (org_id = nullif(current_setting('app.current_org_id', true), '')::uuid);
create policy tenant_isolation_eval_cases on eval_cases
  using (org_id = nullif(current_setting('app.current_org_id', true), '')::uuid)
  with check (org_id = nullif(current_setting('app.current_org_id', true), '')::uuid);
create policy tenant_isolation_eval_runs on eval_runs
  using (org_id = nullif(current_setting('app.current_org_id', true), '')::uuid)
  with check (org_id = nullif(current_setting('app.current_org_id', true), '')::uuid);
create policy tenant_isolation_ai_usage_log on ai_usage_log
  using (org_id = nullif(current_setting('app.current_org_id', true), '')::uuid)
  with check (org_id = nullif(current_setting('app.current_org_id', true), '')::uuid);
```

App role is not a superuser and not the table owner, so `FORCE ROW LEVEL SECURITY` applies. Set `app.current_org_id` with `set_config('app.current_org_id', $org, true)` inside the transaction. No policy that lets the browser role read `provider_credentials.encrypted_key`. Ciphertext is read only by a server module using a role that still sets `org_id`.

`raw_messages.body` is insert-only from the app. No update path.

## BYOK

AES-256-GCM. Master key from `BYOK_ENCRYPTION_KEY` (32 bytes, base64). Store nonce + ciphertext in `encrypted_key`. `key_hint` is the last 4 characters. `resolveProviderSecret(orgId, provider)` caches plaintext in memory for 45 seconds and never returns it to the client. After save, the UI shows the hint only.

## Learning loop (implement later; do not invent a different one)

Nightly, per org:

1. Load `feedback_events` since the last run.
2. Group by `reason_code`.
3. Diagnose:
   - `wrong_policy`, `wrong_fact`, `missing_knowledge` → knowledge gap. Propose a position edit.
   - `too_formal`, `too_casual`, `should_have_asked`, `missed_upsell`, `customer_angry` → procedure gap. Propose a playbook edit.
   - `needs_human` → escalation rule candidate.
   - `irrelevant_source` → retrieval penalty on that source id.
   - `good_as_drafted` → count as evidence for the sources used. Do not propose an edit.
4. Write one `rules` row per proposal, `status = candidate`, `evidence_count` = size of the group. Do not activate it.
5. A human sets `active` or `deprecated`. Activation requires the proposal diff and the evidence count to be visible.
6. Decay: an `active` rule with no supporting feedback for 90 days becomes `deprecated`.

Do not build the job in the first slice. The `rules` table must exist so candidates have a home.

## First slice still in force

Login, one workspace, RLS as above, encrypted keys, inbox review that writes `decision_records` and `feedback_events` using this taxonomy. Seed two workspaces and show that a session in one cannot read the other's rows. No GHL, no MCP, no clustering job, no eval runner.
