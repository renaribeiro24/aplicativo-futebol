-- Test substrate for disposable PostgreSQL ONLY; never a migration.
-- Minimal Auth contract: real RLS/roles, but NOT a running Supabase Auth service.
create role anon nologin noinherit nobypassrls;
create role authenticated nologin noinherit nobypassrls;
create role service_role nologin noinherit bypassrls;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),
    nullif(current_setting('request.jwt.claims',true),'')::jsonb ->> 'sub')::uuid
$$;
grant usage on schema auth,public to anon,authenticated,service_role;
grant execute on function auth.uid() to anon,authenticated,service_role;
