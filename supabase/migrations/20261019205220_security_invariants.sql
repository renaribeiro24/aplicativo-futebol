-- Privileged implementations stay in a schema NOT exposed through PostgREST.
create function private.current_player_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select p.id from public.players p where p.user_id = (select auth.uid()) and p.deleted_at is null
$$;
create function private.group_role(p_group_id uuid) returns text
language sql stable security definer set search_path = '' as $$
  select m.role from public.group_members m
  join public.players p on p.id=m.player_id
  join public.groups g on g.id=m.group_id
  where m.group_id=p_group_id and m.status='active' and p.user_id=(select auth.uid())
    and p.deleted_at is null and g.deleted_at is null
$$;
create function private.can_read_player(p_player_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.players p where p.id=p_player_id and p.deleted_at is null and (
      p.user_id=(select auth.uid()) or exists (
        select 1 from public.group_members target
        join public.group_members actor on actor.group_id=target.group_id
        join public.players ap on ap.id=actor.player_id
        join public.groups g on g.id=actor.group_id
        where target.player_id=p.id and actor.status='active'
          and ap.user_id=(select auth.uid()) and ap.deleted_at is null and g.deleted_at is null
      )
    )
  )
$$;
create function private.require_manager(p_group_id uuid) returns text
language plpgsql volatile security definer set search_path = '' as $$
declare v_role text;
begin
  -- Every membership writer uses this same group row lock BEFORE authorizing.
  perform 1 from public.groups where id=p_group_id and deleted_at is null for update;
  if not found then raise exception 'Grupo indisponível' using errcode='42501'; end if;
  v_role := private.group_role(p_group_id);
  if v_role is null or v_role not in ('owner','admin') then
    raise exception 'Permissão insuficiente' using errcode='42501';
  end if;
  return v_role;
end $$;

create function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$ begin
  new.updated_at := clock_timestamp(); return new;
end $$;
create function private.guard_identity() returns trigger
language plpgsql set search_path = '' as $$
declare v_fields text[]; v_field text;
begin
  v_fields := case tg_table_name
    when 'profiles' then array['id','created_at']
    when 'players' then array['id','user_id','origin_group_id','created_by','created_at']
    when 'groups' then array['id','slug','created_by','created_at']
    when 'group_members' then array['id','group_id','player_id','joined_at','created_at']
    when 'group_invitations' then array['id','group_id','token_hash','role','expires_at','max_uses','created_by','created_at']
    when 'venues' then array['id','group_id','created_at']
    when 'matches' then array['id','group_id','created_by','created_at']
    when 'match_attendance' then array['id','group_id','match_id','player_id','created_at']
  end;
  foreach v_field in array v_fields loop
    if to_jsonb(new)->v_field is distinct from to_jsonb(old)->v_field then
      raise exception 'Campo imutável: %', v_field using errcode='42501';
    end if;
  end loop;
  return new;
end $$;
create function private.validate_timezone() returns trigger
language plpgsql set search_path = '' as $$ begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name=new.timezone) then
    raise exception 'Fuso horário inválido' using errcode='23514';
  end if;
  return new;
end $$;
create trigger groups_timezone before insert or update of timezone on public.groups
for each row execute function private.validate_timezone();

create function private.validate_member() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_user uuid; v_origin uuid; v_deleted timestamptz;
begin
  select user_id, origin_group_id, deleted_at into v_user,v_origin,v_deleted from public.players where id=new.player_id;
  if not found then raise exception 'Jogador inexistente' using errcode='23503'; end if;
  if v_user is null and (v_origin is distinct from new.group_id or new.role <> 'guest') then
    raise exception 'Convidado restrito ao grupo de origem e ao papel guest' using errcode='23514';
  end if;
  if new.role='owner' and (v_user is null or new.status<>'active' or v_deleted is not null) then
    raise exception 'Proprietário deve possuir conta e vínculo ativo' using errcode='23514';
  end if;
  if new.status='active' and v_deleted is not null then
    raise exception 'Jogador arquivado não pode ser ativado' using errcode='23514';
  end if;
  return new;
end $$;
create trigger members_validate before insert or update on public.group_members
for each row execute function private.validate_member();

create function private.check_group_has_owner(p_group_id uuid) returns void
language plpgsql security definer set search_path = '' as $$ begin
  if exists (select 1 from public.groups where id=p_group_id) and (
    select count(*) from public.group_members m join public.players p on p.id=m.player_id
    where m.group_id=p_group_id and m.role='owner' and m.status='active'
      and p.user_id is not null and p.deleted_at is null
  ) <> 1 then
    raise exception 'O grupo deve possuir exatamente um proprietário ativo' using errcode='23514';
  end if;
end $$;
create function private.enforce_group_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_group uuid;
begin
  if tg_table_name='groups' then
    perform private.check_group_has_owner(coalesce(new.id,old.id));
  elsif tg_table_name='group_members' then
    perform private.check_group_has_owner(coalesce(new.group_id,old.group_id));
  else
    for v_group in select group_id from public.group_members where player_id=coalesce(new.id,old.id) loop
      perform private.check_group_has_owner(v_group);
    end loop;
  end if;
  return null;
end $$;
create constraint trigger group_requires_owner after insert or update on public.groups
  deferrable initially deferred for each row execute function private.enforce_group_owner();
create constraint trigger membership_requires_owner after insert or update or delete on public.group_members
  deferrable initially deferred for each row execute function private.enforce_group_owner();
create constraint trigger player_requires_owner after update or delete on public.players
  deferrable initially deferred for each row execute function private.enforce_group_owner();

create function private.audit_membership() returns trigger
language plpgsql security definer set search_path = '' as $$ begin
  if tg_op='INSERT' or new.role is distinct from old.role or new.status is distinct from old.status then
    insert into private.membership_events(member_id,actor_user_id,old_values,new_values)
    values(new.id,auth.uid(),case when tg_op='INSERT' then null else to_jsonb(old) end,to_jsonb(new));
  end if;
  return null;
end $$;
create trigger membership_audit after insert or update on public.group_members
for each row execute function private.audit_membership();

create function private.validate_match() returns trigger
language plpgsql security definer set search_path = '' as $$ begin
  perform private.require_manager(new.group_id);
  if new.venue_id is not null and not exists (
    select 1 from public.venues where id=new.venue_id and group_id=new.group_id and deleted_at is null
  ) then raise exception 'Local não pertence ao grupo ou foi arquivado' using errcode='23503'; end if;
  if new.capacity < (select count(*) from public.match_attendance where match_id=new.id and status='confirmed') then
    raise exception 'Capacidade menor que o total confirmado' using errcode='23514';
  end if;
  return new;
end $$;
create trigger matches_validate before insert or update on public.matches
for each row execute function private.validate_match();
create function private.validate_group_update() returns trigger
language plpgsql security definer set search_path = '' as $$ begin
  -- The updated group row is already locked; recheck authority after any wait.
  perform private.require_manager(new.id); return new;
end $$;
create trigger groups_validate_update before update on public.groups
for each row execute function private.validate_group_update();
create function private.validate_venue() returns trigger
language plpgsql security definer set search_path = '' as $$ begin
  perform private.require_manager(new.group_id); return new;
end $$;
create trigger venues_validate before insert or update on public.venues
for each row execute function private.validate_venue();

create function private.validate_attendance() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_match public.matches%rowtype; v_role text; v_eligible boolean;
begin
  -- Lock order is match, then group, also used by match UPDATE's row trigger.
  select * into v_match from public.matches where id=new.match_id for update;
  if not found or v_match.group_id is distinct from new.group_id then
    raise exception 'Partida de outro grupo ou inexistente' using errcode='23503';
  end if;
  perform 1 from public.groups where id=new.group_id and deleted_at is null for update;
  v_role := private.group_role(new.group_id);
  if v_role is null or (v_role not in ('owner','admin') and new.player_id is distinct from private.current_player_id()) then
    raise exception 'Permissão insuficiente para registrar presença' using errcode='42501';
  end if;
  select exists (select 1 from public.group_members m join public.players p on p.id=m.player_id
    where m.group_id=new.group_id and m.player_id=new.player_id and m.status='active' and p.deleted_at is null)
    into v_eligible;
  if (tg_op='INSERT' or new.status in ('confirmed','waitlisted')) and not v_eligible then
    raise exception 'Jogador sem vínculo elegível' using errcode='23514';
  end if;
  if v_match.status <> 'scheduled' or v_match.deleted_at is not null then
    raise exception 'Partida indisponível para inscrições' using errcode='23514';
  end if;
  if new.status='confirmed' and (select count(*) from public.match_attendance
    where match_id=new.match_id and status='confirmed' and id<>new.id) >= v_match.capacity then
    raise exception 'Sem vagas: use lista de espera' using errcode='23514';
  end if;
  return new;
end $$;
create trigger attendance_validate before insert or update on public.match_attendance
for each row execute function private.validate_attendance();

do $$ declare t text; begin
  foreach t in array array['profiles','players','groups','group_members','group_invitations','venues','matches','match_attendance'] loop
    execute format('create trigger identity_immutable before update on public.%I for each row execute function private.guard_identity()',t);
    execute format('create trigger touch_updated_at before update on public.%I for each row execute function private.touch_updated_at()',t);
  end loop;
end $$;
-- Explicitly close the default PUBLIC function EXECUTE privilege in this schema.
revoke all on all functions in schema private from public, anon, authenticated, service_role;
