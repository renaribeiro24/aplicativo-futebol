-- Incremental Auth bridge. One DO statement makes all changes atomic, including
-- pre/postconditions, even when invoked outside a migration runner transaction.
-- No dynamic DDL or source-text replacement is executed by this migration.
do $migration$
declare expected record; actual pg_catalog.pg_proc%rowtype;
  initial_auth_usage boolean := pg_catalog.has_schema_privilege('app_executor','auth','USAGE');
  initial_auth_select boolean := pg_catalog.has_table_privilege('app_executor','auth.users','SELECT');
begin
  if current_user<>'postgres' then raise exception 'Expected postgres migration role'; end if;
  if pg_catalog.to_regprocedure('private.auth_user_id()') is not null then
    raise exception 'Auth bridge already exists; inspect migration history';
  end if;
  if not exists(select 1 from pg_catalog.pg_roles where rolname='app_executor'
    and not rolcanlogin and not rolsuper and not rolbypassrls and not rolinherit) then
    raise exception 'Unexpected executor role privileges';
  end if;
  if exists(select 1 from pg_catalog.pg_auth_members
    where roleid='app_executor'::regrole and member<>'postgres'::regrole) then
    raise exception 'Unexpected executor role member';
  end if;
  for expected in select * from (values
    ('private.current_player_id()','a1d79eed28548d6319cbd94174231f4e','s','{app_executor=X/app_executor,authenticated=X/app_executor}'),
    ('private.group_role(uuid)','d9b72d0b580661731618266c88124b11','s','{app_executor=X/app_executor,authenticated=X/app_executor}'),
    ('private.can_read_player(uuid)','4007782a690ad9beabb5313574a573e1','s','{app_executor=X/app_executor,authenticated=X/app_executor}'),
    ('private.audit_membership()','fb7f14f540793d47e74296bd584aa687','v','{app_executor=X/app_executor}'),
    ('private.create_group_impl(text,text,text,text,text)','ea7b918439d56a70b56fcba08d3b7e3c','v','{app_executor=X/app_executor,authenticated=X/app_executor}'),
    ('private.add_guest_impl(uuid,text,text)','377827ffcdd14fd948abc221f60733cc','v','{app_executor=X/app_executor,authenticated=X/app_executor}'),
    ('private.create_invitation_impl(uuid,text,text,timestamp with time zone,integer)','587a4ed1703eae322ba6d24b597f20b6','v','{app_executor=X/app_executor,authenticated=X/app_executor}')
  ) as e(signature,source_md5,volatility,acl) loop
    select * into actual from pg_catalog.pg_proc
      where oid=pg_catalog.to_regprocedure(expected.signature);
    if not found or pg_catalog.pg_get_userbyid(actual.proowner)<>'app_executor'
      or not actual.prosecdef or actual.provolatile::text<>expected.volatility
      or actual.proconfig is distinct from array['search_path=""']::text[]
      or actual.proacl::text is distinct from expected.acl
      or pg_catalog.md5(actual.prosrc)<>expected.source_md5 then
      raise exception 'Unexpected function state: %',expected.signature;
    end if;
  end loop;

  -- Only this no-argument, table-free bridge executes as postgres. auth.uid()
  -- returns the caller's request identity; SECURITY DEFINER does not replace it.
  create function private.auth_user_id() returns uuid
  language sql stable security definer set search_path = ''
  as $$ select auth.uid() $$;
  alter function private.auth_user_id() owner to postgres;
  revoke all on function private.auth_user_id() from public, anon, authenticated, service_role;
  grant execute on function private.auth_user_id() to app_executor;

create or replace function private.current_player_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select p.id from public.players p where p.user_id = (select private.auth_user_id()) and p.deleted_at is null
$$;

create or replace function private.group_role(p_group_id uuid) returns text
language sql stable security definer set search_path = '' as $$
  select m.role from public.group_members m
  join public.players p on p.id=m.player_id
  join public.groups g on g.id=m.group_id
  where m.group_id=p_group_id and m.status='active' and p.user_id=(select private.auth_user_id())
    and p.deleted_at is null and g.deleted_at is null
$$;

create or replace function private.can_read_player(p_player_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select private.auth_user_id()) is not null and exists (
    select 1 from public.players p where p.id=p_player_id and p.deleted_at is null and (
      p.user_id=(select private.auth_user_id()) or exists (
        select 1 from public.group_members target
        join public.group_members actor on actor.group_id=target.group_id
        join public.players ap on ap.id=actor.player_id
        join public.groups g on g.id=actor.group_id
        where target.player_id=p.id and actor.status='active'
          and ap.user_id=(select private.auth_user_id()) and ap.deleted_at is null and g.deleted_at is null
      )
    )
  )
$$;

create or replace function private.audit_membership() returns trigger
language plpgsql security definer set search_path = '' as $$ begin
  if tg_op='INSERT' or new.role is distinct from old.role or new.status is distinct from old.status then
    insert into private.membership_events(member_id,actor_user_id,old_values,new_values)
    values(new.id,private.auth_user_id(),case when tg_op='INSERT' then null else to_jsonb(old) end,to_jsonb(new));
  end if;
  return null;
end $$;

create or replace function private.create_group_impl(p_name text,p_slug text,p_description text,p_timezone text,p_logo_url text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_user uuid:=private.auth_user_id(); v_player uuid; v_group uuid; v_name text;
begin
  if v_user is null then raise exception 'Autenticação necessária' using errcode='42501'; end if;
  select display_name into v_name from public.profiles where id=v_user;
  if not found then raise exception 'Crie seu perfil antes do grupo' using errcode='23514'; end if;
  insert into public.players(user_id,name,created_by) values(v_user,v_name,v_user)
    on conflict(user_id) do nothing;
  select id into v_player from public.players where user_id=v_user and deleted_at is null;
  if v_player is null then raise exception 'Identidade esportiva indisponível' using errcode='23514'; end if;
  insert into public.groups(name,slug,description,timezone,logo_url,created_by)
    values(p_name,p_slug,p_description,p_timezone,p_logo_url,v_user) returning id into v_group;
  insert into public.group_members(group_id,player_id,role,status) values(v_group,v_player,'owner','active');
  return v_group;
end $$;

create or replace function private.add_guest_impl(p_group_id uuid,p_name text,p_nickname text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_player uuid;
begin
  perform private.require_manager(p_group_id);
  insert into public.players(user_id,origin_group_id,name,nickname,created_by)
    values(null,p_group_id,p_name,p_nickname,private.auth_user_id()) returning id into v_player;
  insert into public.group_members(group_id,player_id,role,status) values(p_group_id,v_player,'guest','active');
  return v_player;
end $$;

create or replace function private.create_invitation_impl(p_group_id uuid,p_token_hash text,p_role text,p_expires_at timestamptz,p_max_uses integer)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor_role text; v_id uuid;
begin
  v_actor_role:=private.require_manager(p_group_id);
  if p_role is null or p_role not in ('admin','player','guest') or (v_actor_role='admin' and p_role='admin') then
    raise exception 'Papel de convite não permitido' using errcode='42501'; end if;
  if p_expires_at<=clock_timestamp() then raise exception 'Convite já expirado' using errcode='23514'; end if;
  insert into public.group_invitations(group_id,token_hash,role,expires_at,max_uses,created_by)
    values(p_group_id,p_token_hash,p_role,p_expires_at,p_max_uses,private.auth_user_id()) returning id into v_id;
  return v_id;
end $$;

  for expected in select * from (values
    ('private.current_player_id()','42077d51b988abaad37a9bb68db11bbd','s','{app_executor=X/app_executor,authenticated=X/app_executor}'),
    ('private.group_role(uuid)','90c0f44421162ba596b2b4052dde9997','s','{app_executor=X/app_executor,authenticated=X/app_executor}'),
    ('private.can_read_player(uuid)','56332fc19711b0b7d534dda9371243c9','s','{app_executor=X/app_executor,authenticated=X/app_executor}'),
    ('private.audit_membership()','f861452444221ad867b7cb276ec4d3b6','v','{app_executor=X/app_executor}'),
    ('private.create_group_impl(text,text,text,text,text)','85f5a5a4c75ace438b15fd00e1a10f60','v','{app_executor=X/app_executor,authenticated=X/app_executor}'),
    ('private.add_guest_impl(uuid,text,text)','8cc3ea5404164c352488eac647f4f0ed','v','{app_executor=X/app_executor,authenticated=X/app_executor}'),
    ('private.create_invitation_impl(uuid,text,text,timestamp with time zone,integer)','11626be0f7c6371ae95728337d684eeb','v','{app_executor=X/app_executor,authenticated=X/app_executor}')
  ) as e(signature,source_md5,volatility,acl) loop
    select * into actual from pg_catalog.pg_proc
      where oid=pg_catalog.to_regprocedure(expected.signature);
    if not found or pg_catalog.pg_get_userbyid(actual.proowner)<>'app_executor'
      or not actual.prosecdef or actual.provolatile::text<>expected.volatility
      or actual.proconfig is distinct from array['search_path=""']::text[]
      or actual.proacl::text is distinct from expected.acl
      or pg_catalog.md5(actual.prosrc)<>expected.source_md5 then
      raise exception 'Unexpected function state: %',expected.signature;
    end if;
  end loop;

  if pg_catalog.has_function_privilege('anon','private.auth_user_id()','EXECUTE')
    or pg_catalog.has_function_privilege('authenticated','private.auth_user_id()','EXECUTE')
    or pg_catalog.has_function_privilege('service_role','private.auth_user_id()','EXECUTE')
    or not pg_catalog.has_function_privilege('app_executor','private.auth_user_id()','EXECUTE') then
    raise exception 'Unexpected bridge execute permissions';
  end if;
  if exists(select 1 from pg_catalog.pg_proc p,
    lateral pg_catalog.aclexplode(p.proacl) a
    where p.oid='private.auth_user_id()'::regprocedure
      and (a.grantee not in ('postgres'::regrole,'app_executor'::regrole)
        or a.privilege_type<>'EXECUTE')) then
    raise exception 'Unexpected additional bridge grantee';
  end if;
  if initial_auth_usage is distinct from pg_catalog.has_schema_privilege('app_executor','auth','USAGE')
    or initial_auth_select is distinct from pg_catalog.has_table_privilege('app_executor','auth.users','SELECT') then
    raise exception 'Auth privileges unexpectedly changed';
  end if;
end $migration$;
