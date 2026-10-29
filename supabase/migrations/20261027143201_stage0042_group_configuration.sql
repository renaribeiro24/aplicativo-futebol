-- Stage 004.2. Additive only: no seed, match generation, charges or remote operations.
-- Run atomically with the migration runner. Existing rows/policies are not rewritten.
create schema if not exists extensions;
create extension if not exists btree_gist with schema extensions;

create table public.group_schedules (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete restrict,
  venue_id uuid,
  weekday smallint not null check (weekday between 0 and 6),
  starts_at_local time without time zone not null check (starts_at_local < time '24:00'),
  duration_minutes integer not null check (duration_minutes > 0),
  recurrence_type text not null check (recurrence_type in ('weekly','biweekly')),
  interval_weeks smallint not null,
  starts_on date not null check (isfinite(starts_on)),
  ends_on date check (isfinite(ends_on)),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (group_id, venue_id) references public.venues(group_id, id) on delete restrict,
  constraint schedule_interval check (
    (recurrence_type='weekly' and interval_weeks=1) or
    (recurrence_type='biweekly' and interval_weeks=2)
  ),
  constraint schedule_dates check (ends_on is null or ends_on >= starts_on),
  constraint schedule_anchor_weekday check (extract(dow from starts_on)=weekday)
);
create index group_schedules_group_start_idx on public.group_schedules(group_id, starts_on);
create index group_schedules_group_venue_idx on public.group_schedules(group_id, venue_id);
comment on column public.group_schedules.weekday is 'PostgreSQL DOW: 0 Sunday to 6 Saturday.';
comment on column public.group_schedules.starts_on is 'First occurrence and biweekly anchor; subsequent dates differ by multiples of 7 * interval_weeks days. Local dates/time use groups.timezone; ends_on is inclusive.';

create table public.group_pricing_policies (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete restrict,
  monthly_enabled boolean not null,
  monthly_amount_cents integer,
  casual_enabled boolean not null,
  casual_amount_cents integer,
  due_day smallint,
  effective_from date not null check (isfinite(effective_from)),
  effective_until date check (isfinite(effective_until)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pricing_monthly_configuration check (
    (monthly_enabled and monthly_amount_cents is not null and monthly_amount_cents >= 0 and due_day is not null and due_day between 1 and 31) or
    (not monthly_enabled and monthly_amount_cents is null and due_day is null)
  ),
  constraint pricing_casual_configuration check (
    (casual_enabled and casual_amount_cents is not null and casual_amount_cents >= 0) or
    (not casual_enabled and casual_amount_cents is null)
  ),
  constraint pricing_dates check (effective_until is null or effective_until > effective_from),
  constraint pricing_no_overlap exclude using gist (
    group_id extensions.gist_uuid_ops with =,
    daterange(effective_from, effective_until, '[)') with &&
  )
);
create index group_pricing_group_start_idx on public.group_pricing_policies(group_id, effective_from);
comment on table public.group_pricing_policies is 'Explicit prices only, integer cents; guest uses casual price. Validity [effective_from,effective_until), NULL upper bound unbounded. No charges generated.';
comment on column public.group_pricing_policies.due_day is 'Future billing must clamp 29/30/31 to the final day of a shorter month; no due-date calculation in this migration.';

create table public.member_billing_terms (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete restrict,
  player_id uuid not null,
  billing_type text not null check (billing_type in ('monthly','casual')),
  effective_from date not null check (isfinite(effective_from)),
  effective_until date check (isfinite(effective_until)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (group_id, player_id) references public.group_members(group_id, player_id) on delete restrict,
  constraint billing_dates check (effective_until is null or effective_until > effective_from),
  constraint billing_no_overlap exclude using gist (
    group_id extensions.gist_uuid_ops with =,
    player_id extensions.gist_uuid_ops with =,
    daterange(effective_from, effective_until, '[)') with &&
  )
);
create index member_billing_group_player_start_idx on public.member_billing_terms(group_id, player_id, effective_from);
comment on table public.member_billing_terms is 'Classification history, not charges/payments. Validity [effective_from,effective_until); guests may only be casual. No classification seeded.';

-- No new public RPC or privileged client-callable function. Triggers recheck the role
-- AFTER taking the existing tenant lock, serializing with membership/owner changes.
create function private.guard_group_configuration() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_role text;
  v_today date;
  v_member_role text;
  v_member_status text;
  v_player_deleted timestamptz;
begin
  v_role := private.require_manager(new.group_id);
  if tg_table_name='group_pricing_policies' and v_role<>'owner' then
    raise exception 'Somente o proprietário pode configurar preços' using errcode='42501';
  end if;
  if tg_op='UPDATE' then
    if new.id is distinct from old.id or new.group_id is distinct from old.group_id or new.created_at is distinct from old.created_at then
      raise exception 'Identidade e grupo imutáveis' using errcode='42501';
    end if;
    if tg_table_name='member_billing_terms' then
      if new.player_id is distinct from old.player_id then
        raise exception 'Integrante imutável' using errcode='42501';
      end if;
    end if;
  end if;
  if tg_table_name='group_schedules' then
    if new.venue_id is not null and not exists (
      select 1 from public.venues where group_id=new.group_id and id=new.venue_id and deleted_at is null
    ) then
      raise exception 'Local indisponível no grupo' using errcode='23503';
    end if;
  else
    select (clock_timestamp() at time zone g.timezone)::date into v_today from public.groups g where g.id=new.group_id;
    if tg_op='INSERT' then
      if new.effective_from < v_today then
        raise exception 'Vigência retroativa não permitida' using errcode='23514';
      end if;
    else
      -- Once started, keep all original data except a strictly future end date.
      -- No privileged client bypass and no deletion API for history.
      if old.effective_until <= v_today then
        raise exception 'Histórico encerrado é imutável' using errcode='42501';
      end if;
      if old.effective_from <= v_today and
        (to_jsonb(new)-'updated_at'-'effective_until') is distinct from
        (to_jsonb(old)-'updated_at'-'effective_until') then
        raise exception 'Criar nova versão futura para alterar dados vigentes' using errcode='42501';
      end if;
      if new.effective_from < v_today and new.effective_from is distinct from old.effective_from then
        raise exception 'Vigência retroativa não permitida' using errcode='23514';
      end if;
      if new.effective_until is not null and new.effective_until <= v_today then
        raise exception 'Encerramento deve ser futuro' using errcode='23514';
      end if;
    end if;
    if tg_table_name='member_billing_terms' then
      select m.role,m.status,p.deleted_at into v_member_role,v_member_status,v_player_deleted
      from public.group_members m join public.players p on p.id=m.player_id
      where m.group_id=new.group_id and m.player_id=new.player_id;
      if not found then raise exception 'Integrante não pertence ao grupo' using errcode='23503'; end if;
      if v_member_role='guest' and new.billing_type<>'casual' then
        raise exception 'Convidado utiliza classificação avulsa' using errcode='23514';
      end if;
      if tg_op='INSERT' or new.billing_type is distinct from old.billing_type or new.effective_from is distinct from old.effective_from then
        if v_member_status<>'active' or v_player_deleted is not null then
          raise exception 'Integrante indisponível' using errcode='23514';
        end if;
      end if;
    end if;
  end if;
  return new;
end $$;

-- Preserve the guest/casual invariant when an EXISTING membership changes role.
-- Only reads new tables; no rewrite or relaxation of the existing authorization.
create function private.guard_guest_billing_role() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_today date;
begin
  if new.role='guest' and new.role is distinct from old.role then
    perform 1 from public.groups where id=new.group_id for update;
    select (clock_timestamp() at time zone g.timezone)::date into v_today from public.groups g where g.id=new.group_id;
    if exists (select 1 from public.member_billing_terms t where t.group_id=new.group_id and t.player_id=new.player_id
      and t.billing_type='monthly' and (t.effective_until is null or t.effective_until>v_today)) then
      raise exception 'Encerrar classificação mensal antes de atribuir papel guest' using errcode='23514';
    end if;
  end if;
  return new;
end $$;
create trigger members_guest_billing_guard before update of role on public.group_members
for each row execute function private.guard_guest_billing_role();

-- Align technical ownership with the existing application; no new roles/grants to Auth.
grant create on schema public to app_executor;
alter table public.group_schedules owner to app_executor;
alter table public.group_pricing_policies owner to app_executor;
alter table public.member_billing_terms owner to app_executor;
revoke create on schema public from app_executor;
alter function private.guard_group_configuration() owner to app_executor;
alter function private.guard_guest_billing_role() owner to app_executor;
revoke all on function private.guard_group_configuration(), private.guard_guest_billing_role() from public, anon, authenticated, service_role;

do $$ declare t text; begin
  foreach t in array array['group_schedules','group_pricing_policies','member_billing_terms'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public, anon, authenticated, service_role',t);
    execute format('create trigger configuration_guard before insert or update on public.%I for each row execute function private.guard_group_configuration()',t);
    execute format('create trigger configuration_touch before update on public.%I for each row execute function private.touch_updated_at()',t);
  end loop;
end $$;

create policy schedules_read_member on public.group_schedules for select to authenticated
  using (private.group_role(group_id) is not null);
create policy schedules_insert_manager on public.group_schedules for insert to authenticated
  with check (private.group_role(group_id) in ('owner','admin'));
create policy schedules_update_manager on public.group_schedules for update to authenticated
  using (private.group_role(group_id) in ('owner','admin')) with check (private.group_role(group_id) in ('owner','admin'));
grant select on public.group_schedules to authenticated;
grant insert(group_id,venue_id,weekday,starts_at_local,duration_minutes,recurrence_type,interval_weeks,starts_on,ends_on,is_active),
  update(venue_id,weekday,starts_at_local,duration_minutes,recurrence_type,interval_weeks,starts_on,ends_on,is_active)
  on public.group_schedules to authenticated;

create policy pricing_read_member on public.group_pricing_policies for select to authenticated
  using (private.group_role(group_id) is not null);
create policy pricing_insert_owner on public.group_pricing_policies for insert to authenticated
  with check (private.group_role(group_id)='owner');
create policy pricing_update_owner on public.group_pricing_policies for update to authenticated
  using (private.group_role(group_id)='owner') with check (private.group_role(group_id)='owner');
grant select on public.group_pricing_policies to authenticated;
grant insert(group_id,monthly_enabled,monthly_amount_cents,casual_enabled,casual_amount_cents,due_day,effective_from,effective_until),
  update(monthly_enabled,monthly_amount_cents,casual_enabled,casual_amount_cents,due_day,effective_from,effective_until)
  on public.group_pricing_policies to authenticated;

create policy billing_read_manager_or_self on public.member_billing_terms for select to authenticated
  using (private.group_role(group_id) in ('owner','admin') or
    (private.group_role(group_id) is not null and player_id=(select private.current_player_id())));
create policy billing_insert_manager on public.member_billing_terms for insert to authenticated
  with check (private.group_role(group_id) in ('owner','admin'));
create policy billing_update_manager on public.member_billing_terms for update to authenticated
  using (private.group_role(group_id) in ('owner','admin')) with check (private.group_role(group_id) in ('owner','admin'));
grant select on public.member_billing_terms to authenticated;
grant insert(group_id,player_id,billing_type,effective_from,effective_until), update(billing_type,effective_from,effective_until)
  on public.member_billing_terms to authenticated;
-- No DELETE, TRUNCATE, REFERENCES or trigger-management privileges for clients.
