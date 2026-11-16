-- 004.2-L. Apply as ONE transaction only after explicit authorization.
-- No seeds, backfill, legacy UPDATE/DELETE or defaults on new columns.
-- Fail closed on privilege/ownership drift; never repair a remote environment implicitly.
do $$ begin
  if not exists(select 1 from pg_roles where rolname='app_executor' and not rolcanlogin and not rolbypassrls and not rolsuper) then
    raise exception 'Unexpected app_executor privileges' using errcode='42501';
  end if;
  if (select count(*) from pg_class where oid in ('public.groups'::regclass,'public.venues'::regclass,'public.group_schedules'::regclass)
    and relowner='app_executor'::regrole and relrowsecurity)<>3 then
    raise exception 'Unexpected table ownership or RLS state' using errcode='42501';
  end if;
  if to_regprocedure('private.require_manager(uuid)') is null then
    raise exception 'Missing tenant authorization helper' using errcode='42501';
  end if;
end $$;

alter table public.groups add column primary_venue_id uuid;
alter table public.venues
  add column postal_code text,
  add column street text,
  add column street_number text,
  add column complement text,
  add column neighborhood text,
  add column city text,
  add column state text,
  add column latitude double precision,
  add column longitude double precision,
  add column location_provider text,
  add column external_place_id text,
  add column superseded_at timestamptz;

-- Address components unavailable from a provider stay NULL, never invented.
alter table public.venues add constraint venues_structured_address check (
  (postal_code is null or postal_code ~ '^[0-9]{8}$')
  and (street is null or char_length(btrim(street)) between 1 and 200)
  and (street_number is null or char_length(btrim(street_number)) between 1 and 30)
  and (complement is null or char_length(btrim(complement)) between 1 and 120)
  and (neighborhood is null or char_length(btrim(neighborhood)) between 1 and 120)
  and (city is null or char_length(btrim(city)) between 1 and 120)
  and (state is null or state in ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'))
);
alter table public.venues add constraint venue_coordinates check (
 (latitude is null and longitude is null) or
 (latitude is not null and longitude is not null and latitude between -90 and 90 and longitude between -180 and 180)
);
alter table public.venues add constraint venue_external_reference check (
 (location_provider is null and external_place_id is null) or
 (location_provider is not null and location_provider='geoapify' and external_place_id is not null and char_length(btrim(external_place_id)) between 1 and 512 and external_place_id !~ '[[:cntrl:]]')
);
-- Retain uniqueness of CURRENT names; historical versions may share the name.
drop index public.venues_active_name_idx;
create unique index venues_active_name_idx on public.venues(group_id,lower(btrim(name))) where deleted_at is null and superseded_at is null;
create unique index venues_current_external_idx on public.venues(group_id,location_provider,external_place_id)
 where deleted_at is null and superseded_at is null and external_place_id is not null;
alter table public.groups add constraint groups_primary_venue_fkey
  foreign key (id,primary_venue_id) references public.venues(group_id,id) on delete restrict;
create index groups_primary_venue_idx on public.groups(primary_venue_id) where primary_venue_id is not null;
comment on column public.groups.primary_venue_id is 'Explicit principal only; NULL for all legacy groups until a manager configures it. No inferred/backfilled assignment.';
comment on column public.venues.postal_code is 'Canonical Brazilian CEP: eight digits. Legacy address text is independent and preserved verbatim.';

-- New columns remain read-only to Data API clients. Existing RLS/grants untouched.
-- The controlled RPC follows the existing private implementation/invoker wrapper pattern.
create function private.save_group_primary_venue_impl(
  p_group_id uuid, p_name text, p_postal_code text, p_street text,
  p_street_number text, p_neighborhood text, p_city text, p_state text,
  p_venue_id uuid default null, p_expected_primary_venue_id uuid default null,
  p_expected_venue_updated_at timestamptz default null, p_complement text default null,
  p_latitude double precision default null, p_longitude double precision default null,
  p_location_provider text default null, p_external_place_id text default null
) returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare v_current uuid; v_venue public.venues%rowtype; v_id uuid; v_changed boolean;
begin
  perform private.require_manager(p_group_id);
  select primary_venue_id into v_current from public.groups where id=p_group_id;
  if v_current is distinct from p_expected_primary_venue_id then
    raise exception 'Configuração alterada; recarregue antes de salvar' using errcode='40001';
  end if;
  p_name:=btrim(p_name);p_postal_code:=nullif(btrim(p_postal_code),'');p_street:=nullif(btrim(p_street),'');
  p_street_number:=nullif(btrim(p_street_number),'');p_complement:=nullif(btrim(p_complement),'');
  p_neighborhood:=nullif(btrim(p_neighborhood),'');p_city:=nullif(btrim(p_city),'');p_state:=nullif(upper(btrim(p_state)),'');
  p_location_provider:=nullif(btrim(p_location_provider),'');p_external_place_id:=nullif(btrim(p_external_place_id),'');
  if p_venue_id is null then
    if p_expected_venue_updated_at is not null then raise exception 'Versão inválida' using errcode='23514'; end if;
    -- Exact reuse, not matching an arbitrary venue by name or ordering.
    select * into v_venue from public.venues v where v.group_id=p_group_id and v.deleted_at is null and v.superseded_at is null
      and row(v.name,v.postal_code,v.street,v.street_number,v.complement,v.neighborhood,v.city,v.state,v.latitude,v.longitude,v.location_provider,v.external_place_id)
      is not distinct from row(p_name,p_postal_code,p_street,p_street_number,p_complement,p_neighborhood,p_city,p_state,p_latitude,p_longitude,p_location_provider,p_external_place_id)
      for update;
    if found then v_id:=v_venue.id; end if;
  else
    select * into v_venue from public.venues where id=p_venue_id and group_id=p_group_id and deleted_at is null and superseded_at is null for update;
    if not found then raise exception 'Local indisponível no grupo' using errcode='23503'; end if;
    if p_expected_venue_updated_at is null or v_venue.updated_at is distinct from p_expected_venue_updated_at then
      raise exception 'Local alterado; recarregue antes de salvar' using errcode='40001';
    end if;
    v_changed:=row(v_venue.name,v_venue.postal_code,v_venue.street,v_venue.street_number,v_venue.complement,v_venue.neighborhood,v_venue.city,v_venue.state,v_venue.latitude,v_venue.longitude,v_venue.location_provider,v_venue.external_place_id)
      is distinct from row(p_name,p_postal_code,p_street,p_street_number,p_complement,p_neighborhood,p_city,p_state,p_latitude,p_longitude,p_location_provider,p_external_place_id);
    if v_changed and (exists(select 1 from public.group_schedules where group_id=p_group_id and venue_id=v_venue.id)
      or exists(select 1 from public.matches where group_id=p_group_id and venue_id=v_venue.id)) then
      -- Soft versioning only; name/address/coordinates and all old FKs survive.
      update public.venues set superseded_at=clock_timestamp() where id=v_venue.id;
    else
      if v_changed then
        update public.venues set name=p_name,postal_code=p_postal_code,street=p_street,street_number=p_street_number,complement=p_complement,
          neighborhood=p_neighborhood,city=p_city,state=p_state,latitude=p_latitude,longitude=p_longitude,
          location_provider=p_location_provider,external_place_id=p_external_place_id where id=v_venue.id;
      end if;
      v_id:=v_venue.id;
    end if;
  end if;
  if v_id is null then
    insert into public.venues(group_id,name,postal_code,street,street_number,complement,neighborhood,city,state,latitude,longitude,location_provider,external_place_id)
    values(p_group_id,p_name,p_postal_code,p_street,p_street_number,p_complement,p_neighborhood,p_city,p_state,p_latitude,p_longitude,p_location_provider,p_external_place_id)
    returning id into v_id;
  end if;
  update public.groups set primary_venue_id=v_id where id=p_group_id;
  return v_id;
end $$;

create function public.save_group_primary_venue(
  p_group_id uuid, p_name text, p_postal_code text, p_street text,
  p_street_number text, p_neighborhood text, p_city text, p_state text,
  p_venue_id uuid default null, p_expected_primary_venue_id uuid default null,
  p_expected_venue_updated_at timestamptz default null, p_complement text default null,
  p_latitude double precision default null, p_longitude double precision default null,
  p_location_provider text default null, p_external_place_id text default null
) returns uuid language sql volatile security invoker set search_path = '' as $$
  select private.save_group_primary_venue_impl(p_group_id,p_name,p_postal_code,p_street,
    p_street_number,p_neighborhood,p_city,p_state,p_venue_id,p_expected_primary_venue_id,
    p_expected_venue_updated_at,p_complement,p_latitude,p_longitude,p_location_provider,p_external_place_id);
$$;

-- Protect referential lifecycle even for privileged maintenance outside the RPC.
create function private.guard_group_primary_venue() returns trigger
language plpgsql volatile security definer set search_path = '' as $$
declare v_venue public.venues%rowtype;
begin
  if tg_op='UPDATE' and new.primary_venue_id is not distinct from old.primary_venue_id then return new; end if;
  if new.primary_venue_id is null then return new; end if;
  if tg_op='INSERT' then
    raise exception 'Defina o local após criar o grupo' using errcode='23514';
  end if;
  perform private.require_manager(new.id);
  -- FOR UPDATE, not KEY SHARE: must serialize against soft-delete/address updates.
  select * into v_venue from public.venues where id=new.primary_venue_id and group_id=new.id
    and deleted_at is null and superseded_at is null for update;
  if not found then raise exception 'Local indisponível no grupo' using errcode='23503'; end if;
  if not ((v_venue.street is not null and v_venue.city is not null and v_venue.state is not null) or (v_venue.latitude is not null and v_venue.longitude is not null)) then
    raise exception 'Complete o endereço do local principal' using errcode='23514';
  end if;
  return new;
end $$;
create trigger group_primary_venue_guard before insert or update of primary_venue_id on public.groups
for each row execute function private.guard_group_primary_venue();

create function private.guard_primary_venue_lifecycle() returns trigger
language plpgsql volatile security definer set search_path = '' as $$
begin
  -- UPDATE already holds the venue lock. Do not take a group lock here (reverse
  -- ordering would add contention against the RPC's group -> venue order).
  -- Existing venues_validate can still take a tenant lock for direct UPDATEs;
  -- PostgreSQL may abort a deadlock. Never silently retry a stale RPC payload.
  -- Volatile trigger queries see the pointer committed while this UPDATE waited.
  if (new.group_id is distinct from old.group_id or new.deleted_at is not null or not ((new.street is not null and new.city is not null and new.state is not null) or (new.latitude is not null and new.longitude is not null)))
    and exists(select 1 from public.groups where primary_venue_id=old.id) then
    raise exception 'Local principal ativo e completo deve ser preservado' using errcode='23514';
  end if;
  return new;
end $$;
create trigger venue_primary_lifecycle_guard before update of group_id,deleted_at,postal_code,street,street_number,complement,neighborhood,city,state,latitude,longitude
on public.venues for each row execute function private.guard_primary_venue_lifecycle();

-- Insert only: resolve defaults, allow explicit current venues, never rewrite old events.
create function private.assign_schedule_primary_venue() returns trigger
language plpgsql volatile security definer set search_path = '' as $$
declare v_primary uuid;
begin
  perform private.require_manager(new.group_id);
  select primary_venue_id into v_primary from public.groups where id=new.group_id;
  -- Transitional compatibility: without an explicitly configured principal,
  -- keep the original nullable/manual venue behavior and its existing guard.
  -- Never infer a principal from a venue list or rewrite an existing schedule.
  if new.venue_id is null then new.venue_id:=v_primary; end if;
  if new.venue_id is not null and not exists(select 1 from public.venues where id=new.venue_id and group_id=new.group_id and deleted_at is null and superseded_at is null) then
    raise exception 'Local indisponível no grupo' using errcode='23503';
  end if;
  return new;
end $$;
-- Runs before the existing configuration_guard, which still validates active venue and tenant.
create trigger aa_schedule_primary_venue before insert on public.group_schedules
for each row execute function private.assign_schedule_primary_venue();
create trigger aa_match_primary_venue before insert on public.matches
for each row execute function private.assign_schedule_primary_venue();

create function private.freeze_referenced_location() returns trigger language plpgsql security definer set search_path='' as $$ begin
  if (old.superseded_at is not null or old.street is not null or old.latitude is not null)
    and (to_jsonb(new)-array['updated_at','superseded_at','deleted_at']) is distinct from (to_jsonb(old)-array['updated_at','superseded_at','deleted_at'])
    and (exists(select 1 from public.group_schedules where venue_id=old.id and group_id=old.group_id)
      or exists(select 1 from public.matches where venue_id=old.id and group_id=old.group_id)) then
    raise exception 'Local utilizado exige nova versão' using errcode='23514';
  end if;
  return new;
end $$;
create trigger freeze_referenced_location before update on public.venues for each row execute function private.freeze_referenced_location();
create function private.check_primary_current() returns trigger language plpgsql security definer set search_path='' as $$ begin
  if exists(select 1 from public.groups g join public.venues v on v.id=g.primary_venue_id where v.id=new.id and v.superseded_at is not null) then
    raise exception 'Principal não pode ser uma versão histórica' using errcode='23514';
  end if;
  return null;
end $$;
create constraint trigger primary_current_at_commit after update of superseded_at on public.venues
 deferrable initially deferred for each row execute function private.check_primary_current();
alter function private.freeze_referenced_location() owner to app_executor;
alter function private.check_primary_current() owner to app_executor;
revoke all on function private.freeze_referenced_location(),private.check_primary_current() from public,anon,authenticated,service_role;

alter function private.save_group_primary_venue_impl(uuid,text,text,text,text,text,text,text,uuid,uuid,timestamptz,text,double precision,double precision,text,text) owner to app_executor;
alter function private.guard_group_primary_venue() owner to app_executor;
alter function private.guard_primary_venue_lifecycle() owner to app_executor;
alter function private.assign_schedule_primary_venue() owner to app_executor;
revoke all on function private.save_group_primary_venue_impl(uuid,text,text,text,text,text,text,text,uuid,uuid,timestamptz,text,double precision,double precision,text,text)
  from public,anon,authenticated,service_role;
revoke all on function public.save_group_primary_venue(uuid,text,text,text,text,text,text,text,uuid,uuid,timestamptz,text,double precision,double precision,text,text)
  from public,anon,authenticated,service_role;
grant execute on function private.save_group_primary_venue_impl(uuid,text,text,text,text,text,text,text,uuid,uuid,timestamptz,text,double precision,double precision,text,text),
  public.save_group_primary_venue(uuid,text,text,text,text,text,text,text,uuid,uuid,timestamptz,text,double precision,double precision,text,text) to authenticated;
revoke all on function private.guard_group_primary_venue(),private.guard_primary_venue_lifecycle(),private.assign_schedule_primary_venue()
  from public,anon,authenticated,service_role;
-- No new column/table grants, policies, roles, DELETE, cascade or Auth access.

-- A prior broad table grant must not silently expose these new write columns.
do $$ declare c text; r text; begin
  foreach r in array array['anon','authenticated','service_role'] loop
    if has_column_privilege(r,'public.groups','primary_venue_id','INSERT') or has_column_privilege(r,'public.groups','primary_venue_id','UPDATE') then
      raise exception 'Unexpected direct primary pointer grant' using errcode='42501';
    end if;
    foreach c in array array['postal_code','street','street_number','complement','neighborhood','city','state','latitude','longitude','location_provider','external_place_id','superseded_at'] loop
      if has_column_privilege(r,'public.venues',c,'INSERT') or has_column_privilege(r,'public.venues',c,'UPDATE') then
        raise exception 'Unexpected direct structured venue grant' using errcode='42501';
      end if;
    end loop;
  end loop;
end $$;
-- Delivered only if the outer transaction commits; no API configuration changed.
notify pgrst, 'reload schema';
