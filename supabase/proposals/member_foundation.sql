-- Increment A only. Run as ONE transaction, local/isolated only until authorized.
-- Baseline is the eight applied migrations; location L is not a dependency.
-- No legacy rows, financial classifications or obligations are rewritten.
do $$ begin
 if not exists(select 1 from pg_roles where rolname='app_executor' and not rolcanlogin and not rolsuper and not rolbypassrls) then
  raise exception 'Unexpected executor privileges' using errcode='42501';
 end if;
 if has_table_privilege('authenticated','public.group_members','INSERT') or has_table_privilege('authenticated','public.group_members','UPDATE') then
  raise exception 'Unexpected direct membership writes' using errcode='42501';
 end if;
 if to_regprocedure('private.auth_user_id()') is null or to_regprocedure('private.require_manager(uuid)') is null then
  raise exception 'Missing authenticated baseline' using errcode='42501';
 end if;
end $$;
lock table public.group_members in share row exclusive mode;
alter table public.group_members add constraint member_period_identity unique(group_id,id,player_id);
create table public.member_participation_periods (
 id uuid primary key default gen_random_uuid(),
 group_id uuid not null,
 member_id uuid not null,
 player_id uuid not null,
 started_at timestamptz not null check(isfinite(started_at)),
 ended_at timestamptz check(isfinite(ended_at)),
 source text not null check(source in ('observed_at_migration','membership_created','invitation_accepted')),
 end_reason text check(end_reason in ('inactive','left')),
 started_by uuid references auth.users(id) on delete restrict,
 ended_by uuid references auth.users(id) on delete restrict,
 foreign key(group_id,member_id,player_id) references public.group_members(group_id,id,player_id) on delete restrict,
 check(ended_at is null or ended_at>started_at),
 check((ended_at is null and end_reason is null and ended_by is null) or (ended_at is not null and end_reason is not null)),
 exclude using gist(member_id extensions.gist_uuid_ops with =,tstzrange(started_at,ended_at,'[)') with &&)
);
create unique index member_period_one_open on public.member_participation_periods(member_id) where ended_at is null;
create index member_period_tenant_player on public.member_participation_periods(group_id,player_id,started_at);
create index member_period_start_actor on public.member_participation_periods(started_by) where started_by is not null;
create index member_period_end_actor on public.member_participation_periods(ended_by) where ended_by is not null;
alter table public.member_participation_periods enable row level security;
revoke all on public.member_participation_periods from public,anon,authenticated,service_role;
-- Observe only the state we can prove now. Never infer past admissions from names,
-- audit gaps or joined_at; original membership rows remain unchanged.
insert into public.member_participation_periods(group_id,member_id,player_id,started_at,source)
 select group_id,id,player_id,transaction_timestamp(),'observed_at_migration'
 from public.group_members where status='active' and role in ('owner','admin','player');
comment on table public.member_participation_periods is 'Participation periods. observed_at_migration is an observation checkpoint, not reconstructed historical admission. Financial data is unchanged.';
create function private.can_access_group(p_group_id uuid) returns boolean
language sql stable security invoker set search_path='' as $$
 select coalesce(private.group_role(p_group_id) in ('owner','admin','player'),false)
$$;
create function private.guard_member_admission() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if old.status<>'active' and new.status='active' then
  raise exception 'Retorno exige novo convite e aceite; fluxo ainda indisponível' using errcode='42501';
 end if;
 if (old.role='guest') is distinct from (new.role='guest') then
  raise exception 'Participação ocasional não é conversão de vínculo permanente' using errcode='23514';
 end if;
 return new;
end $$;
create trigger member_admission_guard before update of status,role on public.group_members
for each row execute function private.guard_member_admission();
create function private.sync_member_period() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_open uuid; v_now timestamptz:=clock_timestamp();
begin
 -- Compatible with existing writers: group lock before membership mutation.
 perform 1 from public.groups where id=new.group_id for update;
 select id into v_open from public.member_participation_periods
  where member_id=new.id and ended_at is null for update;
 if new.status='active' and new.role in ('owner','admin','player') then
  if v_open is null then
   insert into public.member_participation_periods(group_id,member_id,player_id,started_at,source,started_by)
    values(new.group_id,new.id,new.player_id,v_now,'membership_created',private.auth_user_id());
  end if;
 elsif v_open is not null then
  update public.member_participation_periods set ended_at=v_now,
   end_reason=case when new.status='left' then 'left' else 'inactive' end,
   ended_by=private.auth_user_id() where id=v_open;
 end if;
 return null;
end $$;
create trigger membership_period_sync after insert or update of status,role on public.group_members
for each row execute function private.sync_member_period();
create function private.guard_member_period_history() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if old.ended_at is not null or
   (to_jsonb(new)-array['ended_at','end_reason','ended_by']) is distinct from
   (to_jsonb(old)-array['ended_at','end_reason','ended_by']) then
  raise exception 'Histórico de participação imutável' using errcode='42501';
 end if;
 return new;
end $$;
create trigger member_period_history before update on public.member_participation_periods
for each row execute function private.guard_member_period_history();
create or replace function private.set_member_status_impl(p_group_id uuid,p_member_id uuid,p_status text)
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
  if p_status='active' and v_target.status<>'active' then
    raise exception 'Retorno exige novo convite e aceite' using errcode='42501';
  end if;
  update public.group_members set status=p_status where id=v_target.id and status is distinct from p_status;
end $$;
create or replace function private.set_member_role_impl(p_group_id uuid,p_member_id uuid,p_role text)
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
  if p_role='admin' and v_target.role<>'admin' and (v_target.role<>'player' or v_target.status<>'active') then
    raise exception 'Somente jogador ativo pode ser promovido' using errcode='23514';
  end if;
  update public.group_members set role=p_role where id=v_target.id and role is distinct from p_role;
end $$;
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
          and actor.role in ('owner','admin','player')
          and (actor.role in ('owner','admin') or (target.status='active' and target.role in ('owner','admin','player')))
          and ap.user_id=(select private.auth_user_id()) and ap.deleted_at is null and g.deleted_at is null
      )
    )
  )
$$;
create or replace function private.validate_attendance() returns trigger
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
  if v_role is null or v_role not in ('owner','admin','player') or (v_role not in ('owner','admin') and new.player_id is distinct from private.current_player_id()) then
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
drop policy groups_read_member on public.groups;
create policy groups_read_member on public.groups for select to authenticated
 using(deleted_at is null and private.can_access_group(id));
drop policy members_read_group_or_self on public.group_members;
create policy members_read_group_or_self on public.group_members for select to authenticated
 using(private.can_access_group(group_id) and
 ((status='active' and role in ('owner','admin','player')) or private.group_role(group_id) in ('owner','admin')));
drop policy venues_read_member on public.venues;
create policy venues_read_member on public.venues for select to authenticated
 using(deleted_at is null and private.can_access_group(group_id));
drop policy matches_read_member on public.matches;
create policy matches_read_member on public.matches for select to authenticated
 using(deleted_at is null and private.can_access_group(group_id));
drop policy attendance_read_member on public.match_attendance;
create policy attendance_read_member on public.match_attendance for select to authenticated using(private.can_access_group(group_id));
drop policy attendance_insert_self_or_manager on public.match_attendance;
create policy attendance_insert_self_or_manager on public.match_attendance for insert to authenticated
 with check(private.can_access_group(group_id) and (player_id=private.current_player_id() or private.group_role(group_id) in ('owner','admin')));
drop policy attendance_update_self_or_manager on public.match_attendance;
create policy attendance_update_self_or_manager on public.match_attendance for update to authenticated
 using(private.can_access_group(group_id) and (player_id=private.current_player_id() or private.group_role(group_id) in ('owner','admin')))
 with check(private.can_access_group(group_id) and (player_id=private.current_player_id() or private.group_role(group_id) in ('owner','admin')));
drop policy schedules_read_member on public.group_schedules;
create policy schedules_read_member on public.group_schedules for select to authenticated using(private.can_access_group(group_id));
drop policy pricing_read_member on public.group_pricing_policies;
create policy pricing_read_member on public.group_pricing_policies for select to authenticated using(private.can_access_group(group_id));
drop policy billing_read_manager_or_self on public.member_billing_terms;
create policy billing_read_manager_or_self on public.member_billing_terms for select to authenticated
 using(private.group_role(group_id) in ('owner','admin') or (private.group_role(group_id)='player' and player_id=private.current_player_id()));
create policy member_period_read on public.member_participation_periods for select to authenticated using(private.can_access_group(group_id));
grant select(id,group_id,member_id,player_id,started_at,ended_at,source,end_reason) on public.member_participation_periods to authenticated;

-- Only sports presentation; no contacts, Auth IDs or audit actor fields.
create function private.list_member_profiles_impl(p_group_id uuid,p_status text,p_limit integer,p_offset integer)
returns table(member_id uuid,name text,nickname text,avatar_url text,role text,status text)
language plpgsql stable security definer set search_path='' as $$
declare v_role text;
begin
 v_role:=private.group_role(p_group_id);
 if v_role is null or v_role not in ('owner','admin','player') then raise exception 'Acesso negado' using errcode='42501'; end if;
 if p_status is null or p_status not in ('active','inactive') or p_limit is null or p_limit not between 1 and 100 or p_offset is null or p_offset not between 0 and 1000000 then
  raise exception 'Filtro ou paginação inválidos' using errcode='23514';
 end if;
 if p_status='inactive' and v_role not in ('owner','admin') then raise exception 'Somente gestores consultam inativos' using errcode='42501'; end if;
 return query select m.id,p.name,p.nickname,p.avatar_url,m.role,m.status
  from public.group_members m join public.players p on p.id=m.player_id
  where m.group_id=p_group_id and m.role in ('owner','admin','player') and p.deleted_at is null
  and ((p_status='active' and m.status='active') or (p_status='inactive' and m.status in ('suspended','left')))
  order by m.created_at,m.id limit p_limit offset p_offset;
end $$;
create function public.list_member_profiles(p_group_id uuid,p_status text default 'active',p_limit integer default 20,p_offset integer default 0)
returns table(member_id uuid,name text,nickname text,avatar_url text,role text,status text)
language sql stable security invoker set search_path='' as $$
 select * from private.list_member_profiles_impl(p_group_id,p_status,p_limit,p_offset)
$$;
revoke all on function public.list_member_profiles(uuid,text,integer,integer),private.list_member_profiles_impl(uuid,text,integer,integer) from public,anon,authenticated,service_role;
grant execute on function public.list_member_profiles(uuid,text,integer,integer),private.list_member_profiles_impl(uuid,text,integer,integer) to authenticated;
grant create on schema public to app_executor;
alter table public.member_participation_periods owner to app_executor;
alter function public.list_member_profiles(uuid,text,integer,integer) owner to app_executor;
revoke create on schema public from app_executor;
alter function private.list_member_profiles_impl(uuid,text,integer,integer) owner to app_executor;
alter function private.can_access_group(uuid) owner to app_executor;
alter function private.guard_member_admission() owner to app_executor;
alter function private.sync_member_period() owner to app_executor;
alter function private.guard_member_period_history() owner to app_executor;
revoke all on function private.can_access_group(uuid),private.guard_member_admission(),private.sync_member_period(),private.guard_member_period_history() from public,anon,authenticated,service_role;
grant execute on function private.can_access_group(uuid) to authenticated;
-- Modified legacy functions preserve owners/ACLs; no Auth grants are added.
notify pgrst,'reload schema';
