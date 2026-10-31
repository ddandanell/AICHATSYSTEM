-- App roles. Not domain columns. inbox_app is not a superuser and does not own tables,
-- so FORCE ROW LEVEL SECURITY applies. Ciphertext is not selectable by inbox_app.
-- raw_messages has no update or delete grant: body is insert-only from the app.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'inbox_app') then
    create role inbox_app login password 'inbox_app_dev' nosuperuser nobypassrls nocreatedb nocreaterole;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'inbox_key_reader') then
    create role inbox_key_reader login password 'inbox_key_reader_dev' nosuperuser nobypassrls nocreatedb nocreaterole;
  end if;
end
$$;

grant usage on schema public to inbox_app, inbox_key_reader;
grant connect on database inbox_mychef to inbox_app, inbox_key_reader;

grant select, insert, update, delete on organizations, users, memberships to inbox_app;

grant select, insert, update, delete on
  decision_records,
  feedback_events,
  rules,
  eval_cases,
  eval_runs,
  ai_usage_log
to inbox_app;

-- Table-level SELECT would include encrypted_key. Grant every other column
-- instead, so the browser role cannot read ciphertext. Insert and update
-- still include the column so keys can be saved and rotated.
grant select (
  id, org_id, provider, key_hint, is_active, created_by, created_at, rotated_at
) on provider_credentials to inbox_app;
grant insert (
  id, org_id, provider, encrypted_key, key_hint, is_active, created_by, created_at, rotated_at
) on provider_credentials to inbox_app;
grant update (
  encrypted_key, key_hint, is_active, rotated_at
) on provider_credentials to inbox_app;
grant delete on provider_credentials to inbox_app;

grant select, insert on raw_messages to inbox_app;

grant select on provider_credentials to inbox_key_reader;
