\set ON_ERROR_STOP on
-- Disposable synthetic fixtures only; not HTTP Auth/JWT evidence.
begin;
select id as ga from public.groups where slug='test-alpha' \gset
select id as gb from public.groups where slug='test-beta' \gset
select id as va from public.venues where group_id=:'ga' \gset
select id as vb from public.venues where group_id=:'gb' \gset
select id as pc from public.players where user_id='00000000-0000-4000-8000-000000000003' \gset
select id as pd from public.players where user_id='00000000-0000-4000-8000-000000000004' \gset
select id as pb from public.players where user_id='00000000-0000-4000-8000-000000000002' \gset
select id as pf from public.players where user_id='00000000-0000-4000-8000-000000000006' \gset
select id as guest from public.players where origin_group_id=:'ga' \gset
select (clock_timestamp() at time zone 'America/Sao_Paulo')::date as today \gset
select (:'today'::date+7) as future, extract(dow from :'today'::date+7)::int as weekday \gset
-- Privileged setup only: a confirmed-service simulation is not claimed here.
insert into auth.users(id) values('00000000-0000-4000-8000-000000000007');
insert into public.players(user_id,name,created_by) values('00000000-0000-4000-8000-000000000007','Synthetic authenticated guest','00000000-0000-4000-8000-000000000007') returning id as pg \gset
insert into public.group_members(group_id,player_id,role) values(:'ga',:'pg','guest');
-- Historical fixture preparation is privileged and explicitly separate from RLS proof.
-- Only the new trigger is suspended while seeding past rows in this disposable transaction.
alter table public.group_pricing_policies disable trigger configuration_guard;
insert into public.group_pricing_policies(group_id,monthly_enabled,casual_enabled,effective_from,effective_until)
values(:'ga',false,false,:'today'::date-10,:'today'::date-5) returning id as expired_pricing \gset
alter table public.group_pricing_policies enable trigger configuration_guard;
alter table public.member_billing_terms disable trigger configuration_guard;
insert into public.member_billing_terms(group_id,player_id,billing_type,effective_from,effective_until)
values(:'ga',:'pd','casual',:'today'::date-10,:'today'::date-5) returning id as expired_term \gset
alter table public.member_billing_terms enable trigger configuration_guard;
create function pg_temp.ok(value boolean,label text) returns void language plpgsql security invoker as $$ begin
  if value is distinct from true then raise exception 'FAIL: %',label; end if;
  raise notice 'ok - %',label;
end $$;
create function pg_temp.denied(statement text,state text,label text) returns void language plpgsql security invoker as $$ begin
  begin execute statement;
  exception when others then
    if sqlstate<>state then raise exception 'FAIL: % expected % got %',label,state,sqlstate; end if;
    raise notice 'ok - %',label; return;
  end;
  raise exception 'FAIL: % unexpectedly succeeded',label;
end $$;
set session authorization authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
select pg_temp.ok(session_user='authenticated' and current_user='authenticated','real non-privileged SQL session');
select pg_temp.ok((select count(*)=3 from pg_class where relname in ('group_schedules','group_pricing_policies','member_billing_terms') and relnamespace='public'::regnamespace and relrowsecurity),'all three tables have RLS');
select pg_temp.denied('select private.guard_group_configuration()','42501','private guard not exposed');
select pg_temp.ok(not has_table_privilege('anon','public.group_schedules','SELECT') and not has_table_privilege('anon','public.group_pricing_policies','SELECT') and not has_table_privilege('anon','public.member_billing_terms','SELECT'),'anonymous has no table grants');
select pg_temp.ok(not has_table_privilege('authenticated','public.group_pricing_policies','DELETE') and not has_table_privilege('authenticated','public.member_billing_terms','TRUNCATE'),'history cannot be deleted/truncated');

insert into public.group_schedules(group_id,venue_id,weekday,starts_at_local,duration_minutes,recurrence_type,interval_weeks,starts_on)
values(:'ga',:'va',:weekday,'19:30',90,'weekly',1,:'future') returning id as schedule \gset
select pg_temp.ok((select count(*)=1 from public.group_schedules where id=:'schedule'),'owner creates schedule');
update public.group_schedules set duration_minutes=100 where id=:'schedule';
select pg_temp.ok((select duration_minutes=100 and updated_at>=created_at from public.group_schedules where id=:'schedule'),'owner updates schedule and timestamp');
insert into public.group_schedules(group_id,weekday,starts_at_local,duration_minutes,recurrence_type,interval_weeks,starts_on,ends_on)
values(:'ga',:weekday,'20:00',120,'biweekly',2,:'future',:'future'::date+42) returning id as biweekly \gset
select pg_temp.ok((select starts_on=:'future'::date and interval_weeks=2 and extract(dow from starts_on+14)=weekday from public.group_schedules where id=:'biweekly'),'biweekly preserves exact reference and weekday');
select pg_temp.ok((select interval_weeks=1 and extract(dow from starts_on+7)=weekday from public.group_schedules where id=:'schedule'),'weekly preserves reference');
select pg_temp.denied(format('insert into public.group_schedules(group_id,venue_id,weekday,starts_at_local,duration_minutes,recurrence_type,interval_weeks,starts_on) values(%L,%L,%s,''19:30'',90,''weekly'',1,%L)',:'ga',:'vb',:weekday,:'future'),'23503','cross-group venue rejected');
select pg_temp.denied(format('update public.group_schedules set duration_minutes=0 where id=%L',:'schedule'),'23514','zero duration rejected');
select pg_temp.denied(format('update public.group_schedules set duration_minutes=-1 where id=%L',:'schedule'),'23514','negative duration rejected');
select pg_temp.denied(format('update public.group_schedules set ends_on=starts_on-1 where id=%L',:'schedule'),'23514','schedule dates ordered');
select pg_temp.denied(format('update public.group_schedules set interval_weeks=2 where id=%L',:'schedule'),'23514','weekly cannot become fortnightly by interval alone');
select pg_temp.denied(format('update public.group_schedules set interval_weeks=1 where id=%L',:'biweekly'),'23514','biweekly requires interval two');
select pg_temp.denied(format('update public.group_schedules set starts_on=starts_on+1 where id=%L',:'biweekly'),'23514','anchor weekday mismatch rejected');
select pg_temp.denied(format('update public.group_schedules set weekday=7 where id=%L',:'schedule'),'23514','weekday range checked');
select pg_temp.denied(format('update public.group_schedules set starts_at_local=''24:00'' where id=%L',:'schedule'),'23514','ambiguous end-of-day time rejected');
select pg_temp.denied(format('update public.group_schedules set starts_on=''infinity'' where id=%L',:'schedule'),'23514','infinite schedule date rejected');
select pg_temp.denied(format('update public.group_schedules set group_id=%L where id=%L',:'gb',:'schedule'),'42501','schedule tenant immutable by grants');
select pg_temp.denied(format('update public.group_schedules set created_at=now() where id=%L',:'schedule'),'42501','creation timestamp cannot be forged');

insert into public.group_pricing_policies(group_id,monthly_enabled,monthly_amount_cents,casual_enabled,casual_amount_cents,due_day,effective_from,effective_until)
values(:'ga',true,12345,true,2345,31,:'future',:'future'::date+20) returning id as pricing \gset
update public.group_pricing_policies set monthly_amount_cents=12500 where id=:'pricing';
select pg_temp.ok((select monthly_amount_cents=12500 and due_day=31 from public.group_pricing_policies where id=:'pricing'),'owner modifies future price; cents and due day retained');
select pg_temp.denied(format('update public.group_pricing_policies set monthly_amount_cents=-1 where id=%L',:'pricing'),'23514','negative monthly price rejected');
select pg_temp.denied(format('update public.group_pricing_policies set casual_amount_cents=-1 where id=%L',:'pricing'),'23514','negative casual price rejected');
select pg_temp.denied(format('update public.group_pricing_policies set due_day=0 where id=%L',:'pricing'),'23514','due day zero rejected');
select pg_temp.denied(format('update public.group_pricing_policies set due_day=32 where id=%L',:'pricing'),'23514','due day 32 rejected');
select pg_temp.denied(format('update public.group_pricing_policies set monthly_amount_cents=null where id=%L',:'pricing'),'23514','enabled monthly needs explicit price');
select pg_temp.denied(format('update public.group_pricing_policies set due_day=null where id=%L',:'pricing'),'23514','enabled monthly needs due day');
select pg_temp.denied(format('update public.group_pricing_policies set casual_amount_cents=null where id=%L',:'pricing'),'23514','enabled casual needs explicit price');
select pg_temp.denied(format('update public.group_pricing_policies set monthly_enabled=false where id=%L',:'pricing'),'23514','disabled monthly cannot retain amount/due day');
select pg_temp.denied(format('update public.group_pricing_policies set effective_until=effective_from where id=%L',:'pricing'),'23514','empty financial range rejected');
select pg_temp.denied(format('update public.group_pricing_policies set effective_from=%L where id=%L',:'today'::date-1,:'pricing'),'23514','cannot backdate future version');
select pg_temp.denied(format('insert into public.group_pricing_policies(group_id,monthly_enabled,casual_enabled,effective_from) values(%L,false,false,%L)',:'ga',:'today'::date-1),'23514','backdated insert rejected');
select pg_temp.denied(format('insert into public.group_pricing_policies(group_id,monthly_enabled,casual_enabled,effective_from) values(%L,false,false,%L)',:'ga',:'future'::date+1),'23P01','overlapping unbounded pricing rejected');
insert into public.group_pricing_policies(group_id,monthly_enabled,casual_enabled,effective_from)
values(:'ga',false,false,:'future'::date+20) returning id as next_pricing \gset
select pg_temp.ok((select count(*)=3 from public.group_pricing_policies where group_id=:'ga'),'adjacent financial ranges accepted; no defaults invented');
select pg_temp.denied(format('update public.group_pricing_policies set effective_until=%L where id=%L',:'future'::date+21,:'pricing'),'23P01','overlap on update rejected');
select pg_temp.denied(format('update public.group_pricing_policies set group_id=%L where id=%L',:'gb',:'pricing'),'42501','pricing tenant immutable');
-- Current data immutable, future ending and replacement still possible atomically.
insert into public.group_pricing_policies(group_id,monthly_enabled,casual_enabled,effective_from,effective_until)
values(:'ga',false,false,:'today',:'future') returning id as current_pricing \gset
select pg_temp.denied(format('update public.group_pricing_policies set casual_enabled=true,casual_amount_cents=1 where id=%L',:'current_pricing'),'42501','started price cannot be overwritten');
select pg_temp.denied(format('update public.group_pricing_policies set effective_from=effective_from+1 where id=%L',:'current_pricing'),'42501','started effective_from immutable');
select pg_temp.denied(format('update public.group_pricing_policies set effective_until=%L where id=%L',:'today',:'current_pricing'),'23514','cannot close current policy retroactively');
update public.group_pricing_policies set effective_until=:'today'::date+3 where id=:'current_pricing';
select pg_temp.ok((select effective_until=:'today'::date+3 from public.group_pricing_policies where id=:'current_pricing'),'owner can close current policy strictly in future');

insert into public.member_billing_terms(group_id,player_id,billing_type,effective_from,effective_until)
values(:'ga',:'pc','monthly',:'future',:'future'::date+20) returning id as term \gset
update public.member_billing_terms set billing_type='casual' where id=:'term';
select pg_temp.ok((select billing_type='casual' from public.member_billing_terms where id=:'term'),'owner creates and changes future classification');
select pg_temp.denied(format('insert into public.member_billing_terms(group_id,player_id,billing_type,effective_from) values(%L,%L,''monthly'',%L)',:'ga',:'pb',:'future'),'23503','member of B cannot be classified in A');
select pg_temp.denied(format('insert into public.member_billing_terms(group_id,player_id,billing_type,effective_from) values(%L,%L,''monthly'',%L)',:'ga',:'guest',:'future'),'23514','guest cannot be monthly');
insert into public.member_billing_terms(group_id,player_id,billing_type,effective_from) values(:'ga',:'guest','casual',:'future');
select pg_temp.ok((select count(*)=1 from public.member_billing_terms where player_id=:'guest'),'guest uses casual classification without dedicated price');
select pg_temp.denied(format('insert into public.member_billing_terms(group_id,player_id,billing_type,effective_from) values(%L,%L,''monthly'',%L)',:'ga',:'pc',:'future'::date+1),'23P01','overlapping member terms rejected');
insert into public.member_billing_terms(group_id,player_id,billing_type,effective_from) values(:'ga',:'pc','monthly',:'future'::date+20);
select pg_temp.ok((select count(*)=2 from public.member_billing_terms where player_id=:'pc'),'adjacent member versions preserve history');
select pg_temp.denied(format('update public.member_billing_terms set effective_until=effective_from-1 where id=%L',:'term'),'23514','member dates ordered');
select pg_temp.denied(format('update public.member_billing_terms set billing_type=''other'' where id=%L',:'term'),'23514','unknown billing type rejected');
select pg_temp.denied(format('update public.member_billing_terms set player_id=%L where id=%L',:'pd',:'term'),'42501','classification identity immutable');
select pg_temp.denied(format('update public.member_billing_terms set group_id=%L where id=%L',:'gb',:'term'),'42501','classification group immutable');
insert into public.member_billing_terms(group_id,player_id,billing_type,effective_from,effective_until)
values(:'ga',:'pc','monthly',:'today',:'future') returning id as current_term \gset
select pg_temp.denied(format('update public.member_billing_terms set billing_type=''casual'' where id=%L',:'current_term'),'42501','current classification cannot be overwritten');
select pg_temp.denied(format('select public.set_member_role(%L,(select id from public.group_members where group_id=%L and player_id=%L),''guest'')',:'ga',:'ga',:'pc'),'23514','membership role cannot bypass guest casual invariant');

select pg_temp.denied(format('update public.group_pricing_policies set effective_until=null where id=%L',:'expired_pricing'),'42501','expired pricing cannot be reopened');
select pg_temp.denied(format('update public.member_billing_terms set effective_until=null where id=%L',:'expired_term'),'42501','expired classification cannot be reopened');
select pg_temp.denied(format('insert into public.member_billing_terms(group_id,player_id,billing_type,effective_from) values(%L,%L,''casual'',%L)',:'ga',:'pf',:'today'::date-1),'23514','backdated classification insert rejected');
select pg_temp.denied(format('update public.member_billing_terms set effective_until=%L where id=%L',:'today',:'current_term'),'23514','classification cannot close retroactively');
select pg_temp.denied(format('update public.member_billing_terms set effective_from=%L where id=%L',:'today'::date-1,:'term'),'23514','future classification cannot be backdated');
select pg_temp.denied(format('delete from public.group_pricing_policies where id=%L',:'pricing'),'42501','owner cannot delete financial history');
select pg_temp.denied(format('delete from public.member_billing_terms where id=%L',:'term'),'42501','owner cannot delete classification history');
select pg_temp.denied(format('delete from public.group_schedules where id=%L',:'schedule'),'42501','owner deactivates schedule instead of deleting');
-- Reject an archived venue, even within the same tenant (only local fixture archived).
reset session authorization;
insert into public.venues(group_id,name,deleted_at) values(:'ga','Synthetic archived venue',now()) returning id as archived_venue \gset
set session authorization authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
select pg_temp.denied(format('update public.group_schedules set venue_id=%L where id=%L',:'archived_venue',:'schedule'),'23503','archived venue rejected');
-- Atomic replacement: any failure in the second write rolls back the first one.
create function pg_temp.failed_replacement(policy uuid, tenant uuid, d date) returns void language plpgsql security invoker as $$ begin
  begin
    update public.group_pricing_policies set effective_until=d where id=policy;
    insert into public.group_pricing_policies(group_id,monthly_enabled,casual_enabled,effective_from)
      values(tenant,true,false,d); -- Intentionally invalid: monthly price/due day missing.
    raise exception 'FAIL: invalid replacement succeeded';
  exception when check_violation then null; end;
end $$;
select pg_temp.failed_replacement(:'current_pricing',:'ga',:'today'::date+2);
select pg_temp.ok((select effective_until=:'today'::date+3 from public.group_pricing_policies where id=:'current_pricing'),'failed replacement rolls back earlier closure');
-- A valid successor exactly on the old upper bound is accepted without rewriting old values.
insert into public.group_pricing_policies(group_id,monthly_enabled,casual_enabled,effective_from,effective_until)
values(:'ga',false,false,:'today'::date+3,:'future');
select pg_temp.ok((select effective_until=:'today'::date+3 and not monthly_enabled and not casual_enabled from public.group_pricing_policies where id=:'current_pricing'),'successful successor preserves historical policy');
-- Manager changes do not confer price authority.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000004',true);
insert into public.group_schedules(group_id,weekday,starts_at_local,duration_minutes,recurrence_type,interval_weeks,starts_on)
values(:'ga',:weekday,'21:00',60,'weekly',1,:'future') returning id as admin_schedule \gset
update public.group_schedules set duration_minutes=75 where id=:'admin_schedule';
select pg_temp.ok((select duration_minutes=75 from public.group_schedules where id=:'admin_schedule'),'admin creates and updates schedule');
update public.member_billing_terms set billing_type='monthly' where id=:'term';
select pg_temp.ok((select billing_type='monthly' from public.member_billing_terms where id=:'term'),'admin updates future billing terms');
insert into public.member_billing_terms(group_id,player_id,billing_type,effective_from) values(:'ga',:'pd','casual',:'future');
select pg_temp.ok((select count(*)=2 from public.member_billing_terms where player_id=:'pd'),'admin creates member billing terms');
select pg_temp.denied(format('insert into public.group_pricing_policies(group_id,monthly_enabled,casual_enabled,effective_from) values(%L,false,false,%L)',:'ga',:'today'::date+4),'42501','admin cannot insert prices');
with changed as (update public.group_pricing_policies set monthly_amount_cents=1 where id=:'pricing' returning id)
select pg_temp.ok((select count(*)=0 from changed),'admin price update changes no rows');
select pg_temp.ok((select monthly_amount_cents=12500 from public.group_pricing_policies where id=:'pricing'),'original price unchanged after admin attempt');

insert into public.member_billing_terms(group_id,player_id,billing_type,effective_from) values(:'ga',:'pg','casual',:'future');
-- Player then authenticated guest: read authorized data, never administration.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
select pg_temp.ok((select count(*)=3 from public.group_schedules where group_id=:'ga'),'player reads own schedules');
select pg_temp.ok((select count(*)=3 from public.member_billing_terms where player_id=:'pc'),'player reads own classification history');
select pg_temp.ok(not exists(select 1 from public.member_billing_terms where player_id<>:'pc'::uuid),'player cannot read other billing classifications');
select pg_temp.denied(format('insert into public.group_schedules(group_id,weekday,starts_at_local,duration_minutes,recurrence_type,interval_weeks,starts_on) values(%L,%s,''10:00'',60,''weekly'',1,%L)',:'ga',:weekday,:'future'),'42501','player cannot insert schedules');
with changed as (update public.group_schedules set duration_minutes=1 where id=:'schedule' returning id)
select pg_temp.ok((select count(*)=0 from changed),'player cannot update schedules');
select pg_temp.denied(format('insert into public.group_pricing_policies(group_id,monthly_enabled,casual_enabled,effective_from) values(%L,false,false,%L)',:'ga',:'future'),'42501','player cannot insert prices');
with changed as (update public.group_pricing_policies set monthly_amount_cents=1 where id=:'pricing' returning id)
select pg_temp.ok((select count(*)=0 from changed),'player cannot update prices');
select pg_temp.denied(format('insert into public.member_billing_terms(group_id,player_id,billing_type,effective_from) values(%L,%L,''casual'',%L)',:'ga',:'pc',:'future'),'42501','player cannot classify self');
with changed as (update public.member_billing_terms set billing_type='casual' where id=:'term' returning id)
select pg_temp.ok((select count(*)=0 from changed),'player cannot update own classification');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000007',true);
select pg_temp.ok(private.group_role(:'ga')='guest','guest test is authenticated guest, not anon');
select pg_temp.ok((select count(*)=3 from public.group_schedules where group_id=:'ga'),'active guest reads group schedule only');
select pg_temp.ok((select count(*)=1 and bool_and(player_id=:'pg'::uuid) from public.member_billing_terms),'guest reads only own casual term');
select pg_temp.denied(format('insert into public.group_schedules(group_id,weekday,starts_at_local,duration_minutes,recurrence_type,interval_weeks,starts_on) values(%L,%s,''10:00'',60,''weekly'',1,%L)',:'ga',:weekday,:'future'),'42501','guest cannot insert schedules');
with changed as (update public.group_schedules set duration_minutes=1 where id=:'schedule' returning id)
select pg_temp.ok((select count(*)=0 from changed),'guest cannot update schedules');
select pg_temp.denied(format('insert into public.group_pricing_policies(group_id,monthly_enabled,casual_enabled,effective_from) values(%L,false,false,%L)',:'ga',:'future'),'42501','guest cannot insert prices');
with changed as (update public.group_pricing_policies set monthly_amount_cents=1 where id=:'pricing' returning id)
select pg_temp.ok((select count(*)=0 from changed),'guest cannot update prices');
select pg_temp.denied(format('insert into public.member_billing_terms(group_id,player_id,billing_type,effective_from) values(%L,%L,''casual'',%L)',:'ga',:'pg',:'future'),'42501','guest cannot administer classification');

with changed as (update public.member_billing_terms set billing_type='monthly' where player_id=:'pg' returning id)
select pg_temp.ok((select count(*)=0 from changed),'guest cannot modify own classification');
-- Suspended actor loses every new-table read; restore synthetic status for later tests.
reset session authorization;
set session authorization authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
select public.set_member_status(:'ga',(select id from public.group_members where group_id=:'ga' and player_id=:'pc'),'suspended');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
select pg_temp.ok(not exists(select 1 from public.group_schedules) and not exists(select 1 from public.group_pricing_policies) and not exists(select 1 from public.member_billing_terms),'suspended player loses all new-table access');
select pg_temp.denied(format('insert into public.member_billing_terms(group_id,player_id,billing_type,effective_from) values(%L,%L,''casual'',%L)',:'ga',:'pc',:'future'),'42501','suspended actor cannot administer');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
select pg_temp.denied(format('insert into public.member_billing_terms(group_id,player_id,billing_type,effective_from) values(%L,%L,''casual'',%L)',:'ga',:'pc',:'future'),'23514','manager cannot add classification for suspended target');
select public.set_member_status(:'ga',(select id from public.group_members where group_id=:'ga' and player_id=:'pc'),'active');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
select pg_temp.ok(not exists(select 1 from public.group_schedules),'B cannot read A schedules');
select pg_temp.ok(not exists(select 1 from public.group_pricing_policies),'B cannot read A prices');
select pg_temp.ok(not exists(select 1 from public.member_billing_terms),'B cannot read A terms');
with changed as (update public.group_schedules set duration_minutes=1 where id=:'schedule' returning id)
select pg_temp.ok((select count(*)=0 from changed),'B cannot update A schedule');
select pg_temp.denied(format('insert into public.member_billing_terms(group_id,player_id,billing_type,effective_from) values(%L,%L,''casual'',%L)',:'ga',:'pb',:'future'),'42501','B cannot insert into A');
with changed as (update public.group_pricing_policies set monthly_amount_cents=1 where id=:'pricing' returning id)
select pg_temp.ok((select count(*)=0 from changed),'B cannot update A pricing');
with changed as (update public.member_billing_terms set billing_type='casual' where id=:'term' returning id)
select pg_temp.ok((select count(*)=0 from changed),'B cannot update A billing terms');
-- Same actor in both groups still cannot move a record to another tenant.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
select public.create_group('Synthetic configuration extra','stage0042-extra') as gc \gset
select pg_temp.denied(format('update public.group_schedules set group_id=%L where id=%L',:'gc',:'schedule'),'42501','even owner of both groups cannot transfer schedules');
select pg_temp.denied(format('update public.group_pricing_policies set group_id=%L where id=%L',:'gc',:'pricing'),'42501','even owner of both cannot transfer prices');
select pg_temp.denied(format('update public.member_billing_terms set group_id=%L where id=%L',:'gc',:'term'),'42501','even owner of both cannot transfer classification');
select pg_temp.ok((select duration_minutes=100 from public.group_schedules where id=:'schedule'),'all denied attempts preserved schedule');
select pg_temp.ok((select monthly_amount_cents=12500 from public.group_pricing_policies where id=:'pricing'),'all denied attempts preserved price');
select pg_temp.ok((select billing_type='monthly' from public.member_billing_terms where id=:'term'),'all denied attempts preserved classification');
reset session authorization;
-- Defense in depth under the technical table owner: column grants cannot explain this rejection.
set session authorization app_executor;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
select pg_temp.denied(format('update public.group_schedules set group_id=%L,venue_id=null where id=%L',:'gc',:'schedule'),'42501','trigger blocks tenant reassignment even as technical owner');
select pg_temp.denied(format('update public.member_billing_terms set player_id=%L where id=%L',:'pd',:'term'),'42501','trigger blocks member reassignment even as technical owner');
reset session authorization;
set session authorization anon;
select pg_temp.denied('select * from public.group_schedules','42501','anonymous schedule read denied');
select pg_temp.denied('select * from public.group_pricing_policies','42501','anonymous pricing read denied');
select pg_temp.denied('select * from public.member_billing_terms','42501','anonymous billing read denied');
reset session authorization;
set constraints all immediate;
rollback;
