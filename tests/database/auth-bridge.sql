-- SQL identity/ACL regression only; this does not exercise Auth HTTP or real JWTs.
-- SET LOCAL ROLE also works with the non-superuser hosted migration connection.
-- security.sql separately uses unprivileged session authorization in local tests.
begin;
do $$ begin
  if has_schema_privilege('app_executor','auth','USAGE')
    or has_table_privilege('app_executor','auth.users','SELECT') then
    raise exception 'Executor unexpectedly gained Auth data privileges';
  end if;
  set local role app_executor;
  perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
  if private.auth_user_id() is distinct from '00000000-0000-4000-8000-000000000001'::uuid then
    raise exception 'Bridge returned another identity';
  end if;
  perform set_config('request.jwt.claim.sub','',true);
  perform set_config('request.jwt.claims','{}',true);
  if private.auth_user_id() is not null then raise exception 'Missing identity must remain null'; end if;
  reset role;
end $$;
set local role authenticated;
do $$ begin
  begin
    perform private.auth_user_id();
    raise exception 'Authenticated client directly executed internal bridge';
  exception when insufficient_privilege then null; end;
  begin
    perform public.create_group('No identity','no-identity');
    raise exception 'Missing identity created a group';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
do $$ begin
  begin
    perform private.auth_user_id();
    raise exception 'Anonymous caller directly executed bridge';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
