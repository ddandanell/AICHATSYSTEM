-- Agent spec DDL. Do not add columns or policies here.
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
