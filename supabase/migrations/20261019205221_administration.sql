create function private.create_group_impl(p_name text,p_slug text,p_description text,p_timezone text,p_logo_url text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_user uuid:=auth.uid(); v_player uuid; v_group uuid; v_name text;
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
create function private.add_guest_impl(p_group_id uuid,p_name text,p_nickname text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_player uuid;
begin
  perform private.require_manager(p_group_id);
  insert into public.players(user_id,origin_group_id,name,nickname,created_by)
    values(null,p_group_id,p_name,p_nickname,auth.uid()) returning id into v_player;
  insert into public.group_members(group_id,player_id,role,status) values(p_group_id,v_player,'guest','active');
  return v_player;
end $$;
create function private.set_member_role_impl(p_group_id uuid,p_member_id uuid,p_role text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_actor_role text; v_target public.group_members%rowtype;
begin
  v_actor_role:=private.require_manager(p_group_id);
  select * into v_target from public.group_members where id=p_member_id and group_id=p_group_id for update;
  if not found then raise exception 'Vínculo indisponível' using errcode='42501'; end if;
  if v_target.player_id=private.current_player_id() or v_target.role='owner' or p_role='owner' then
    raise exception 'Use transferência de propriedade; alteração própria não permitida' using errcode='42501';
  end if;
  if p_role is null or p_role not in ('admin','player','guest') then raise exception 'Papel inválido' using errcode='23514'; end if;
  if v_actor_role='admin' and (v_target.role='admin' or p_role='admin') then
    raise exception 'Administrador não gerencia administradores' using errcode='42501';
  end if;
  update public.group_members set role=p_role where id=v_target.id;
end $$;
create function private.set_member_status_impl(p_group_id uuid,p_member_id uuid,p_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_actor_role text; v_target public.group_members%rowtype;
begin
  v_actor_role:=private.require_manager(p_group_id);
  select * into v_target from public.group_members where id=p_member_id and group_id=p_group_id for update;
  if not found then raise exception 'Vínculo indisponível' using errcode='42501'; end if;
  if v_target.player_id=private.current_player_id() or v_target.role='owner' or (v_actor_role='admin' and v_target.role='admin') then
    raise exception 'Alteração de status não permitida' using errcode='42501';
  end if;
  if p_status is null or p_status not in ('active','invited','suspended','left') then raise exception 'Status inválido' using errcode='23514'; end if;
  update public.group_members set status=p_status where id=v_target.id;
end $$;
create function private.transfer_ownership_impl(p_group_id uuid,p_member_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_target public.group_members%rowtype; v_actor uuid;
begin
  if private.require_manager(p_group_id)<>'owner' then raise exception 'Somente o proprietário pode transferir' using errcode='42501'; end if;
  v_actor:=private.current_player_id();
  select * into v_target from public.group_members where id=p_member_id and group_id=p_group_id for update;
  if not found then raise exception 'Vínculo indisponível' using errcode='42501'; end if;
  if v_target.player_id=v_actor or v_target.status<>'active' or not exists (
    select 1 from public.players where id=v_target.player_id and user_id is not null and deleted_at is null
  ) then raise exception 'Novo proprietário inelegível' using errcode='23514'; end if;
  update public.group_members set role='admin' where group_id=p_group_id and player_id=v_actor and role='owner' and status='active';
  update public.group_members set role='owner' where id=v_target.id;
end $$;
create function private.create_invitation_impl(p_group_id uuid,p_token_hash text,p_role text,p_expires_at timestamptz,p_max_uses integer)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_actor_role text; v_id uuid;
begin
  v_actor_role:=private.require_manager(p_group_id);
  if p_role is null or p_role not in ('admin','player','guest') or (v_actor_role='admin' and p_role='admin') then
    raise exception 'Papel de convite não permitido' using errcode='42501'; end if;
  if p_expires_at<=clock_timestamp() then raise exception 'Convite já expirado' using errcode='23514'; end if;
  insert into public.group_invitations(group_id,token_hash,role,expires_at,max_uses,created_by)
    values(p_group_id,p_token_hash,p_role,p_expires_at,p_max_uses,auth.uid()) returning id into v_id;
  return v_id;
end $$;
create function private.list_invitations_impl(p_group_id uuid)
returns table(id uuid,role text,expires_at timestamptz,max_uses integer,uses_count integer,created_at timestamptz,revoked_at timestamptz)
language plpgsql security definer set search_path = '' as $$ begin
  perform private.require_manager(p_group_id);
  return query select i.id,i.role,i.expires_at,i.max_uses,i.uses_count,i.created_at,i.revoked_at
    from public.group_invitations i where i.group_id=p_group_id order by i.created_at desc;
end $$;
create function private.revoke_invitation_impl(p_group_id uuid,p_invitation_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_role text; v_invite_role text;
begin
  v_role:=private.require_manager(p_group_id);
  select role into v_invite_role from public.group_invitations where id=p_invitation_id and group_id=p_group_id for update;
  if not found or (v_role='admin' and v_invite_role='admin') then raise exception 'Convite indisponível' using errcode='42501'; end if;
  update public.group_invitations set revoked_at=coalesce(revoked_at,clock_timestamp()) where id=p_invitation_id;
end $$;

-- Exposed wrappers are SECURITY INVOKER. Implementations are private, with checks.
create function public.create_group(p_name text,p_slug text,p_description text default null,p_timezone text default 'America/Sao_Paulo',p_logo_url text default null)
returns uuid language sql security invoker set search_path = '' as $$ select private.create_group_impl(p_name,p_slug,p_description,p_timezone,p_logo_url) $$;
create function public.add_guest(p_group_id uuid,p_name text,p_nickname text default null)
returns uuid language sql security invoker set search_path = '' as $$ select private.add_guest_impl(p_group_id,p_name,p_nickname) $$;
create function public.set_member_role(p_group_id uuid,p_member_id uuid,p_role text)
returns void language sql security invoker set search_path = '' as $$ select private.set_member_role_impl(p_group_id,p_member_id,p_role) $$;
create function public.set_member_status(p_group_id uuid,p_member_id uuid,p_status text)
returns void language sql security invoker set search_path = '' as $$ select private.set_member_status_impl(p_group_id,p_member_id,p_status) $$;
create function public.transfer_ownership(p_group_id uuid,p_member_id uuid)
returns void language sql security invoker set search_path = '' as $$ select private.transfer_ownership_impl(p_group_id,p_member_id) $$;
create function public.create_invitation(p_group_id uuid,p_token_hash text,p_role text,p_expires_at timestamptz,p_max_uses integer default 1)
returns uuid language sql security invoker set search_path = '' as $$ select private.create_invitation_impl(p_group_id,p_token_hash,p_role,p_expires_at,p_max_uses) $$;
create function public.list_invitations(p_group_id uuid)
returns table(id uuid,role text,expires_at timestamptz,max_uses integer,uses_count integer,created_at timestamptz,revoked_at timestamptz)
language sql security invoker set search_path = '' as $$ select * from private.list_invitations_impl(p_group_id) $$;
create function public.revoke_invitation(p_group_id uuid,p_invitation_id uuid)
returns void language sql security invoker set search_path = '' as $$ select private.revoke_invitation_impl(p_group_id,p_invitation_id) $$;

revoke all on all functions in schema private from public, anon, authenticated, service_role;
do $$ declare f record; begin
  for f in select oid::regprocedure as signature from pg_proc where pronamespace='public'::regnamespace
    and proname=any(array['create_group','add_guest','set_member_role','set_member_status','transfer_ownership','create_invitation','list_invitations','revoke_invitation']) loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role',f.signature);
  end loop;
end $$;
