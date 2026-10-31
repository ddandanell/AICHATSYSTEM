-- Retrieval tables. Not part of the decision-ledger DDL.
-- Same forced RLS pattern: org_id must equal app.current_org_id.
-- unique (org_id, id) lets chunks reference a document inside the same workspace only.

create table documents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  kind text not null check (kind in ('position', 'playbook', 'decision')),
  source_id text not null,
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  unique (org_id, id),
  unique (org_id, kind, source_id)
);

create table chunks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id),
  document_id uuid not null,
  ordinal int not null,
  body text not null,
  embedding vector(256) not null,
  created_at timestamptz not null default now(),
  unique (org_id, document_id, ordinal),
  foreign key (org_id, document_id) references documents (org_id, id) on delete cascade
);

create index chunks_embedding_hnsw on chunks using hnsw (embedding vector_cosine_ops);

alter table documents enable row level security;
alter table documents force row level security;
alter table chunks enable row level security;
alter table chunks force row level security;

create policy tenant_isolation_documents on documents
  using (org_id = nullif(current_setting('app.current_org_id', true), '')::uuid)
  with check (org_id = nullif(current_setting('app.current_org_id', true), '')::uuid);
create policy tenant_isolation_chunks on chunks
  using (org_id = nullif(current_setting('app.current_org_id', true), '')::uuid)
  with check (org_id = nullif(current_setting('app.current_org_id', true), '')::uuid);

grant select, insert, update, delete on documents, chunks to inbox_app;
