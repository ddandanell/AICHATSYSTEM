-- Extra providers and an audit trail. Grants apply only when inbox_app exists.

alter table provider_credentials drop constraint if exists provider_credentials_provider_check;
alter table provider_credentials add constraint provider_credentials_provider_check
  check (provider in (
    'openai',
    'anthropic',
    'azure_openai',
    'bedrock',
    'google',
    'vercel_gateway',
    'deepseek'
  ));

alter table provider_credentials add column if not exists base_url text;
alter table documents add column if not exists scope text;

create table if not exists audit_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  kind text not null check (kind in ('feedback', 'rule_status')),
  summary text not null,
  created_at timestamptz not null default now()
);

alter table audit_events enable row level security;
alter table audit_events force row level security;
drop policy if exists tenant_isolation_audit_events on audit_events;
create policy tenant_isolation_audit_events on audit_events
  using (org_id = nullif(current_setting('app.current_org_id', true), '')::uuid)
  with check (org_id = nullif(current_setting('app.current_org_id', true), '')::uuid);

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'inbox_app') then
    grant select (base_url), insert (base_url), update (base_url) on provider_credentials to inbox_app;
    grant select, insert on audit_events to inbox_app;
    grant update (scope) on documents to inbox_app;
  end if;
end
$$;
