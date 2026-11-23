-- Increment B. Prepared and tested in disposable databases only.
-- Requires Increment A. No remote application, email dispatch or retention jobs.
do $$ begin
 if to_regclass('public.member_participation_periods') is null then raise exception 'Increment A required'; end if;
 if has_table_privilege('app_executor','auth.users','SELECT') then raise exception 'Unexpected Auth grants' using errcode='42501'; end if;
end $$;
alter table public.group_members add constraint member_group_identity unique(group_id,id);
alter table public.member_participation_periods add constraint member_period_scope unique(group_id,player_id,id);
alter table public.member_participation_periods drop constraint member_participation_periods_source_check;
alter table public.member_participation_periods add constraint member_participation_periods_source_check
 check(source in ('observed_at_migration','membership_created','invitation_accepted','request_approved'));
alter table public.member_billing_terms add column participation_period_id uuid;
alter table public.member_billing_terms add constraint member_billing_period_fk
 foreign key(group_id,player_id,participation_period_id) references public.member_participation_periods(group_id,player_id,id) on delete restrict;
alter table public.member_billing_terms drop constraint billing_no_overlap;
alter table public.member_billing_terms add constraint billing_no_overlap exclude using gist(
 group_id extensions.gist_uuid_ops with =,player_id extensions.gist_uuid_ops with =,
 (coalesce(participation_period_id,'00000000-0000-0000-0000-000000000000'::uuid)) extensions.gist_uuid_ops with =,
 daterange(effective_from,effective_until,'[)') with &&);
create index billing_period_idx on public.member_billing_terms(participation_period_id) where participation_period_id is not null;
comment on column public.member_billing_terms.participation_period_id is 'NULL preserves legacy classification; new admissions have period-scoped casual terms. No historical row is rewritten.';
alter table public.group_invitations add column recipient_email text,
 add column accepted_by uuid references auth.users(id) on delete restrict,
 add column accepted_at timestamptz,
 add column accepted_member_id uuid,
 add column revocation_reason text check(revocation_reason in ('revoked','expired','rotated'));
alter table public.group_invitations add constraint invitation_member_scope
 foreign key(group_id,accepted_member_id) references public.group_members(group_id,id) on delete restrict;
alter table public.group_invitations add constraint invitation_acceptance_complete check(
 (accepted_by is null and accepted_at is null and accepted_member_id is null) or
 (accepted_by is not null and accepted_at is not null and accepted_member_id is not null));
create unique index individual_pending_recipient on public.group_invitations(group_id,recipient_email)
 where recipient_email is not null and revoked_at is null and accepted_at is null;
create index invitation_recipient_actor on public.group_invitations(accepted_by) where accepted_by is not null;
create index invitation_member_idx on public.group_invitations(group_id,accepted_member_id) where accepted_member_id is not null;

create table private.member_join_links(
 id uuid primary key default gen_random_uuid(),group_id uuid not null references public.groups(id) on delete restrict,
 token_hash text not null unique check(token_hash~'^[0-9a-f]{64}$'),
 label text not null check(char_length(btrim(label)) between 1 and 80),
 max_uses integer check(max_uses>0),uses_count integer not null default 0 check(uses_count>=0),
 created_by uuid not null references auth.users(id) on delete restrict,
 created_at timestamptz not null default clock_timestamp(),revoked_at timestamptz,
 check(max_uses is null or uses_count<=max_uses),unique(group_id,id)
);
create index join_links_group on private.member_join_links(group_id,created_at);
create table private.member_join_requests(
 id uuid primary key default gen_random_uuid(),group_id uuid not null,link_id uuid not null,
 applicant_id uuid not null references auth.users(id) on delete restrict,
 verified_email text not null,name text not null,
 state text not null default 'pending' check(state in ('pending','approved','rejected','expired')),
 created_at timestamptz not null default clock_timestamp(),
 reviewed_at timestamptz,reviewed_by uuid references auth.users(id) on delete restrict,
 member_id uuid,
 foreign key(group_id,link_id) references private.member_join_links(group_id,id) on delete restrict,
 foreign key(group_id,member_id) references public.group_members(group_id,id) on delete restrict,
 check((state='approved' and member_id is not null and reviewed_by is not null and reviewed_at is not null) or (state<>'approved' and member_id is null))
);
create unique index pending_member_request on private.member_join_requests(group_id,applicant_id) where state='pending';
create index join_requests_group on private.member_join_requests(group_id,state,created_at);
create table private.member_contacts(
 group_id uuid not null,member_id uuid not null,verified_email text not null,
 verified_at timestamptz not null default clock_timestamp(),primary key(group_id,member_id),
 foreign key(group_id,member_id) references public.group_members(group_id,id) on delete restrict
);
create table private.member_email_budget(
 recipient_hash text primary key,last_reserved_at timestamptz not null
);
create table private.member_deliveries(
 id uuid primary key default gen_random_uuid(),group_id uuid not null references public.groups(id) on delete restrict,
 invitation_id uuid not null unique references public.group_invitations(id) on delete restrict,
 state text not null default 'prepared' check(state in ('prepared','blocked','failed')),
 created_at timestamptz not null default clock_timestamp(),finished_at timestamptz,
 error_code text check(error_code in ('delivery_disabled','provider_failure','provider_rejected'))
);
create table private.member_receipts(
 actor uuid not null references auth.users(id) on delete restrict,request_id uuid not null,
 payload_hash text not null,result jsonb not null,created_at timestamptz not null default clock_timestamp(),
 primary key(actor,request_id)
);
create table private.member_admission_context(
 member_id uuid primary key,group_id uuid not null,player_id uuid not null,
 actor uuid not null,transaction_id xid8 not null,
 kind text not null check(kind in ('individual','request')),period_id uuid,consumed boolean not null default false
);
create table private.member_intake_events(
 id bigint generated always as identity primary key,group_id uuid not null references public.groups(id) on delete restrict,
 actor uuid not null references auth.users(id) on delete restrict,operation text not null,target_id uuid,
 occurred_at timestamptz not null default clock_timestamp()
);
do $$ declare t text; begin
 foreach t in array array['member_join_links','member_join_requests','member_contacts','member_email_budget','member_deliveries','member_receipts','member_admission_context','member_intake_events'] loop
  execute format('alter table private.%I enable row level security',t);
  execute format('revoke all on private.%I from public,anon,authenticated,service_role',t);
  execute format('alter table private.%I owner to app_executor',t);
 end loop;
end $$;

-- Narrow Auth bridge: current verified account only, no arguments/user enumeration.
-- postgres owns this helper; app_executor gets EXECUTE, never auth schema/table grants.
create function private.member_verified_email() returns text
language sql stable security definer set search_path='' as $$
 select lower(btrim(u.email)) from auth.users u
 where u.id=(select auth.uid()) and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false)
 and u.email is not null
$$;
revoke all on function private.member_verified_email() from public,anon,authenticated,service_role;
grant execute on function private.member_verified_email() to app_executor;

drop trigger member_admission_guard on public.group_members;
create or replace function private.guard_member_admission() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_required boolean;
begin
 v_required:=case when tg_op='INSERT' then new.role<>'owner' and new.status='active' and new.role<>'guest'
 else (old.status<>'active' and new.status='active') or ((old.role='guest') is distinct from (new.role='guest')) end;
 if v_required then
  if new.role<>'player' or new.status<>'active' then raise exception 'Admission requires player role' using errcode='42501'; end if;
  update private.member_admission_context set consumed=true
   where member_id=new.id and group_id=new.group_id and player_id=new.player_id
   and actor=(select private.auth_user_id()) and transaction_id=pg_current_xact_id() and not consumed;
  if not found then raise exception 'New invitation acceptance required' using errcode='42501'; end if;
 end if;
 return new;
end $$;
create trigger member_admission_guard before insert or update of status,role on public.group_members
for each row execute function private.guard_member_admission();

create or replace function private.sync_member_period() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_open uuid;v_now timestamptz:=clock_timestamp();v_kind text;v_today date;
begin
 perform 1 from public.groups where id=new.group_id for update;
 select id into v_open from public.member_participation_periods where member_id=new.id and ended_at is null for update;
 if new.status='active' and new.role in ('owner','admin','player') then
  if v_open is null then
   select kind into v_kind from private.member_admission_context
    where member_id=new.id and transaction_id=pg_current_xact_id() and consumed;
   insert into public.member_participation_periods(group_id,member_id,player_id,started_at,source,started_by)
   values(new.group_id,new.id,new.player_id,v_now,
    case v_kind when 'individual' then 'invitation_accepted' when 'request' then 'request_approved' else 'membership_created' end,
    private.auth_user_id()) returning id into v_open;
   update private.member_admission_context set period_id=v_open where member_id=new.id and transaction_id=pg_current_xact_id();
   select (clock_timestamp() at time zone timezone)::date into v_today from public.groups where id=new.group_id;
   insert into public.member_billing_terms(group_id,player_id,participation_period_id,billing_type,effective_from)
    values(new.group_id,new.player_id,v_open,'casual',v_today);
  end if;
 elsif v_open is not null then
  update public.member_participation_periods set ended_at=v_now,
   end_reason=case when new.status='left' then 'left' else 'inactive' end,ended_by=private.auth_user_id() where id=v_open;
 end if;
 return null;
end $$;
create or replace function private.guard_group_configuration() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_role text;
  v_today date;
  v_member_role text;
  v_member_status text;
  v_player_deleted timestamptz;
begin
  if tg_table_name='member_billing_terms' then
    if tg_op='UPDATE' and new.participation_period_id is distinct from old.participation_period_id then
      raise exception 'Billing period immutable' using errcode='42501';
    end if;
    if new.participation_period_id is not null and not exists(
      select 1 from public.member_participation_periods p where p.id=new.participation_period_id
      and p.group_id=new.group_id and p.player_id=new.player_id and p.ended_at is null) then
      raise exception 'Current participation period required' using errcode='23503';
    end if;
    if tg_op='INSERT' and new.billing_type='casual' and new.effective_until is null
      and new.effective_from=(select (clock_timestamp() at time zone timezone)::date from public.groups where id=new.group_id)
      and exists(select 1 from private.member_admission_context c where c.group_id=new.group_id and c.player_id=new.player_id
      and c.period_id=new.participation_period_id and c.actor=private.auth_user_id() and c.transaction_id=pg_current_xact_id() and c.consumed) then
      return new;
    end if;
  end if;
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

create function private.member_admit(p_group uuid,p_user uuid,p_email text,p_kind text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_player uuid;v_member public.group_members%rowtype;v_id uuid;
begin
 -- Only command handlers call this internal helper, after locking and authorizing.
 select id into v_player from public.players where user_id=p_user and deleted_at is null;
 if v_player is null then raise exception 'Identity unavailable' using errcode='23514'; end if;
 select * into v_member from public.group_members where group_id=p_group and player_id=v_player for update;
 if found then
  if v_member.status='active' and v_member.role<>'guest' then raise exception 'Already active' using errcode='P4091'; end if;
  if p_kind<>'individual' then raise exception 'Return requires individual invitation' using errcode='P4092'; end if;
  v_id:=v_member.id;
 else v_id:=gen_random_uuid(); end if;
 insert into private.member_admission_context(member_id,group_id,player_id,actor,transaction_id,kind)
 values(v_id,p_group,v_player,private.auth_user_id(),pg_current_xact_id(),p_kind);
 if v_member.id is null then
  insert into public.group_members(id,group_id,player_id,role,status) values(v_id,p_group,v_player,'player','active');
 else
  update public.group_members set role='player',status='active' where id=v_id;
 end if;
 delete from private.member_admission_context where member_id=v_id and transaction_id=pg_current_xact_id();
 insert into private.member_contacts(group_id,member_id,verified_email) values(p_group,v_id,p_email)
 on conflict(group_id,member_id) do update set verified_email=excluded.verified_email,verified_at=clock_timestamp();
 return v_id;
end $$;
create or replace function private.create_invitation_impl(p_group_id uuid,p_token_hash text,p_role text,p_expires_at timestamptz,p_max_uses integer)
returns uuid language plpgsql security definer set search_path='' as $$
begin
 perform private.require_manager(p_group_id);
 raise exception 'Use recipient-bound individual invitation' using errcode='42501';
end $$;

create function private.member_command_impl(p_operation text,p_group_id uuid,p_request_id uuid,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 u uuid:=private.auth_user_id(); e text; r text; gid uuid:=p_group_id;
 inv public.group_invitations%rowtype; l private.member_join_links%rowtype;
 q private.member_join_requests%rowtype; receipt private.member_receipts%rowtype;
 h text; recipient text; mode text; rid uuid; mid uuid; pid uuid; result jsonb;
 stamp timestamptz:=clock_timestamp(); today date; scope uuid; last_try timestamptz;
begin
 if u is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>8192 then raise exception 'Invalid request' using errcode='22023'; end if;
 if p_operation not in ('data','create_invitation','create_link','revoke_invitation','revoke_link','preview','accept','request','review','billing','finish_delivery') then raise exception 'Unknown operation' using errcode='22023'; end if;
 if p_operation in ('preview','accept','request') then
  e:=private.member_verified_email();
  if e is null then raise exception 'Confirmed account required' using errcode='42501'; end if;
  h:=p_payload->>'token_hash';
  if h is null or h!~'^[0-9a-f]{64}$' then raise exception 'Invalid invitation' using errcode='22023'; end if;
  if p_payload->>'kind'='individual' then
   select * into inv from public.group_invitations where token_hash=h;
   if not found or inv.recipient_email is null or inv.recipient_email<>e then raise exception 'Invitation unavailable' using errcode='42501'; end if;
   gid:=inv.group_id;
  elsif p_payload->>'kind'='shared' and p_operation<>'accept' then
   select * into l from private.member_join_links where token_hash=h;
   if not found then raise exception 'Link unavailable' using errcode='42501'; end if;
   gid:=l.group_id;
  else raise exception 'Invalid invitation type' using errcode='22023'; end if;
 end if;
 -- Every mutating path shares tenant-first lock order and revalidates afterwards.
 perform 1 from public.groups where id=gid and deleted_at is null for update;
 if not found then raise exception 'Group unavailable' using errcode='42501'; end if;
 r:=private.group_role(gid);
 select (stamp at time zone timezone)::date into today from public.groups where id=gid;
 if p_operation not in ('preview','accept','request','data') then perform private.require_manager(gid); end if;

 if p_operation='data' then
  if r is null or r not in ('owner','admin','player') then raise exception 'Group unavailable' using errcode='42501'; end if;
  select jsonb_build_object('role',r,'members',coalesce(jsonb_agg(jsonb_build_object(
   'id',m.id,'name',p.name,'nickname',p.nickname,'avatar',pr.avatar_url,'role',m.role,'status',m.status,
   'email',case when r in ('owner','admin') then c.verified_email end,
   'billing',case when r in ('owner','admin') or p.user_id=u then
    (select bt.billing_type from public.member_billing_terms bt
      where bt.group_id=gid and bt.player_id=p.id and bt.effective_from<=today and (bt.effective_until is null or bt.effective_until>today)
      and (bt.participation_period_id=period.id or (bt.participation_period_id is null and period.source='observed_at_migration'))
      order by (bt.participation_period_id is not null) desc,bt.effective_from desc limit 1) end,
   'periods',(select coalesce(jsonb_agg(jsonb_build_object('start',mp.started_at,'end',mp.ended_at) order by mp.started_at),'[]'::jsonb) from public.member_participation_periods mp where mp.member_id=m.id),
   'terms',case when r in ('owner','admin') or p.user_id=u then
    (select coalesce(jsonb_agg(jsonb_build_object('id',bt.id,'type',bt.billing_type,'from',bt.effective_from,'until',bt.effective_until,'period',bt.participation_period_id) order by bt.effective_from desc),'[]'::jsonb)
     from public.member_billing_terms bt where bt.group_id=gid and bt.player_id=p.id) else '[]'::jsonb end
  ) order by p.name,m.id),'[]'::jsonb)) into result
  from public.group_members m join public.players p on p.id=m.player_id
  left join public.profiles pr on pr.id=p.user_id
  left join private.member_contacts c on c.group_id=m.group_id and c.member_id=m.id
  left join public.member_participation_periods period on period.member_id=m.id and period.ended_at is null
  where m.group_id=gid and m.role<>'guest' and (r in ('owner','admin') or m.status='active');
  if r in ('owner','admin') then
   result:=result||jsonb_build_object(
    'invitations',(select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'email',i.recipient_email,'expires',i.expires_at,'accepted',i.accepted_at,'revoked',i.revoked_at,
       'delivery',(select d.state from private.member_deliveries d where d.invitation_id=i.id)) order by i.created_at desc),'[]'::jsonb) from public.group_invitations i where i.group_id=gid and i.recipient_email is not null),
    'links',(select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'label',a.label,'max',a.max_uses,'used',a.uses_count,'revoked',a.revoked_at) order by a.created_at desc),'[]'::jsonb) from private.member_join_links a where a.group_id=gid),
    'requests',(select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'name',a.name,'email',a.verified_email,'state',case when a.state='pending' and a.created_at<stamp-interval '30 days' then 'expired' else a.state end,'created',a.created_at) order by a.created_at desc),'[]'::jsonb) from private.member_join_requests a where a.group_id=gid));
  end if;
  return result;
 end if;

 if p_operation in ('create_invitation','create_link') then
  if p_request_id is null then raise exception 'Idempotency required' using errcode='22023'; end if;
  -- Same actor across groups is serialized before looking up a receipt.
  perform pg_advisory_xact_lock(hashtextextended('member-request:'||u::text,0));
  h:=encode(extensions.digest(convert_to(jsonb_build_object('op',p_operation,'group',gid,'payload',p_payload)::text,'UTF8'),'sha256'),'hex');
  select * into receipt from private.member_receipts where actor=u and request_id=p_request_id;
  if found then
   if receipt.payload_hash<>h then raise exception 'Request changed' using errcode='22023'; end if;
   return receipt.result;
  end if;
  if (p_payload->>'token_hash') is null or (p_payload->>'token_hash')!~'^[0-9a-f]{64}$' then raise exception 'Invalid token hash' using errcode='22023'; end if;
  if p_operation='create_invitation' then
   recipient:=lower(btrim(p_payload->>'email'));mode:=p_payload->>'delivery';
   if recipient is null or char_length(recipient)>254 or recipient!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or mode not in ('manual','automatic') or mode is null then raise exception 'Invalid recipient' using errcode='22023'; end if;
   if mode='automatic' then
    perform pg_advisory_xact_lock(hashtextextended('member-email:'||recipient,0));
    select last_reserved_at into last_try from private.member_email_budget where recipient_hash=encode(extensions.digest(recipient,'sha256'),'hex') for update;
    if last_try is not null and last_try>stamp-interval '24 hours' then raise exception 'Automatic email limited to one attempt per 24 hours' using errcode='P4290'; end if;
    insert into private.member_email_budget(recipient_hash,last_reserved_at) values(encode(extensions.digest(recipient,'sha256'),'hex'),stamp)
    on conflict(recipient_hash) do update set last_reserved_at=excluded.last_reserved_at;
   end if;
   update public.group_invitations set revoked_at=stamp,revocation_reason=case when expires_at<=stamp then 'expired' else 'rotated' end
    where group_id=gid and recipient_email=recipient and accepted_at is null and revoked_at is null;
   insert into public.group_invitations(group_id,token_hash,role,expires_at,max_uses,created_by,recipient_email)
    values(gid,p_payload->>'token_hash','player',stamp+interval '30 days',1,u,recipient) returning id into rid;
   if mode='automatic' then
    -- Explicit hard gate: no provider credentials/transport, never report delivered.
    insert into private.member_deliveries(group_id,invitation_id,state,finished_at,error_code)
     values(gid,rid,'blocked',stamp,'delivery_disabled');
   end if;
   result:=jsonb_build_object('id',rid,'delivery',case when mode='automatic' then 'blocked' else 'manual' end);
  else
   if char_length(btrim(coalesce(p_payload->>'label',''))) not between 1 and 80 then raise exception 'Invalid label' using errcode='22023'; end if;
   if p_payload->>'max_uses' is not null and ((p_payload->>'max_uses')!~'^[0-9]{1,8}$' or (p_payload->>'max_uses')::int<1) then raise exception 'Invalid limit' using errcode='22023'; end if;
   insert into private.member_join_links(group_id,token_hash,label,max_uses,created_by)
    values(gid,p_payload->>'token_hash',btrim(p_payload->>'label'),(p_payload->>'max_uses')::integer,u) returning id into rid;
   result:=jsonb_build_object('id',rid);
  end if;
  insert into private.member_receipts(actor,request_id,payload_hash,result) values(u,p_request_id,h,result);
 elsif p_operation in ('preview','accept') and inv.id is not null then
  select * into inv from public.group_invitations where id=inv.id for update;
  if inv.recipient_email<>e then raise exception 'Invitation unavailable' using errcode='42501'; end if;
  if inv.accepted_by is not null then
   if inv.accepted_by<>u then raise exception 'Invitation unavailable' using errcode='42501'; end if;
   return jsonb_build_object('accepted',true,'member',inv.accepted_member_id);
  end if;
  if inv.revoked_at is not null or inv.expires_at<=stamp or inv.role<>'player' or inv.uses_count<>0 or inv.max_uses<>1 then raise exception 'Invitation unavailable' using errcode='42501'; end if;
  if p_operation='preview' then return jsonb_build_object('group',(select name from public.groups where id=gid),'kind','individual'); end if;
  perform private.ensure_my_identity_impl(left(coalesce(nullif(btrim(p_payload->>'name'),''),split_part(e,'@',1)),80));
  mid:=private.member_admit(gid,u,e,'individual');
  update public.group_invitations set accepted_by=u,accepted_at=stamp,accepted_member_id=mid,uses_count=1 where id=inv.id;
  result:=jsonb_build_object('accepted',true,'member',mid,'slug',(select slug from public.groups where id=gid));
 elsif p_operation in ('preview','request') and l.id is not null then
  select * into l from private.member_join_links where id=l.id for update;
  if l.revoked_at is not null or (l.max_uses is not null and l.uses_count>=l.max_uses) then raise exception 'Link unavailable' using errcode='42501'; end if;
  if p_operation='preview' then return jsonb_build_object('group',(select name from public.groups where id=gid),'kind','shared'); end if;
  if exists(select 1 from public.group_members m join public.players p on p.id=m.player_id where m.group_id=gid and p.user_id=u) then raise exception 'Existing members return by individual invitation' using errcode='P4092'; end if;
  perform private.ensure_my_identity_impl(left(coalesce(nullif(btrim(p_payload->>'name'),''),split_part(e,'@',1)),80));
  update private.member_join_requests set state='expired',reviewed_at=stamp where group_id=gid and applicant_id=u and state='pending' and created_at<stamp-interval '30 days';
  select id into rid from private.member_join_requests where group_id=gid and applicant_id=u and state='pending';
  if rid is null then
   insert into private.member_join_requests(group_id,link_id,applicant_id,verified_email,name)
    select gid,l.id,u,e,p.name from public.players p where p.user_id=u returning id into rid;
  end if;
  result:=jsonb_build_object('id',rid,'state','pending');
 elsif p_operation='review' then
  select * into q from private.member_join_requests where id=(p_payload->>'id')::uuid and group_id=gid for update;
  if not found or q.state<>'pending' then raise exception 'Request unavailable' using errcode='P4090'; end if;
  if q.created_at<stamp-interval '30 days' then raise exception 'Request expired' using errcode='P4090'; end if;
  if p_payload->>'decision'='approve' then
   select * into l from private.member_join_links where id=q.link_id for update;
   if l.revoked_at is not null or (l.max_uses is not null and l.uses_count>=l.max_uses) then raise exception 'Link unavailable' using errcode='42501'; end if;
   -- Confirmed email is captured by the applicant's authenticated request. No manager chooses identity.
   mid:=private.member_admit(gid,q.applicant_id,q.verified_email,'request');
   update private.member_join_links set uses_count=uses_count+1 where id=l.id;
   update private.member_join_requests set state='approved',member_id=mid,reviewed_by=u,reviewed_at=stamp where id=q.id;
  elsif p_payload->>'decision'='reject' then
   update private.member_join_requests set state='rejected',reviewed_by=u,reviewed_at=stamp where id=q.id;
  else raise exception 'Invalid decision' using errcode='22023'; end if;
  result:=jsonb_build_object('state',case when mid is null then 'rejected' else 'approved' end);
 elsif p_operation='revoke_invitation' then
  update public.group_invitations set revoked_at=coalesce(revoked_at,stamp),revocation_reason='revoked'
   where id=(p_payload->>'id')::uuid and group_id=gid and accepted_at is null returning id into rid;
  if rid is null then raise exception 'Invitation unavailable' using errcode='P4090'; end if;
  result:=jsonb_build_object('revoked',true);
 elsif p_operation='revoke_link' then
  update private.member_join_links set revoked_at=coalesce(revoked_at,stamp)
   where id=(p_payload->>'id')::uuid and group_id=gid returning id into rid;
  if rid is null then raise exception 'Link unavailable' using errcode='P4090'; end if;
  result:=jsonb_build_object('revoked',true);
 elsif p_operation='billing' then
  select player_id into pid from public.group_members where id=(p_payload->>'id')::uuid and group_id=gid and status='active' and role<>'guest' for update;
  if not found then raise exception 'Member unavailable' using errcode='42501'; end if;
  select id into scope from public.member_participation_periods where group_id=gid and player_id=pid and ended_at is null;
  if scope is null or p_payload->>'type' not in ('monthly','casual') or (p_payload->>'from')::date<=today then raise exception 'Future date required' using errcode='23514'; end if;
  -- End current period classification independently; never rewrite previous periods/charges.
  update public.member_billing_terms set effective_until=(p_payload->>'from')::date
   where group_id=gid and player_id=pid and participation_period_id=scope and effective_from<(p_payload->>'from')::date and effective_until is null;
  insert into public.member_billing_terms(group_id,player_id,billing_type,effective_from,participation_period_id)
   values(gid,pid,p_payload->>'type',(p_payload->>'from')::date,scope) returning id into rid;
  result:=jsonb_build_object('id',rid);
 elsif p_operation='finish_delivery' then
  raise exception 'Email delivery disabled' using errcode='42501';
 else raise exception 'Invalid operation' using errcode='22023';
 end if;
 insert into private.member_intake_events(group_id,actor,operation,target_id) values(gid,u,p_operation,coalesce(rid,mid));
 return result;
end $$;

create function public.member_command(p_operation text,p_group_id uuid default null,p_request_id uuid default null,p_payload jsonb default '{}'::jsonb)
returns jsonb language sql security invoker set search_path='' as $$
 select private.member_command_impl(p_operation,p_group_id,p_request_id,p_payload);
$$;
alter function private.member_admit(uuid,uuid,text,text) owner to app_executor;
alter function private.member_command_impl(text,uuid,uuid,jsonb) owner to app_executor;
revoke all on function private.member_admit(uuid,uuid,text,text) from public,anon,authenticated,service_role;
revoke all on function private.member_command_impl(text,uuid,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function private.member_command_impl(text,uuid,uuid,jsonb) to authenticated;
revoke all on function public.member_command(text,uuid,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.member_command(text,uuid,uuid,jsonb) to authenticated;
-- No client can choose a participation scope directly.
revoke insert,update on public.member_billing_terms from authenticated;
grant insert(group_id,player_id,billing_type,effective_from,effective_until) on public.member_billing_terms to authenticated;
grant update(billing_type,effective_from,effective_until) on public.member_billing_terms to authenticated;
comment on function public.member_command(text,uuid,uuid,jsonb) is 'Increment B; authenticated, tenant-locked commands and privacy projection. No live email delivery.';
