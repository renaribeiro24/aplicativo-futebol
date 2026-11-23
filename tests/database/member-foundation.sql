\set ON_ERROR_STOP on
-- Entirely synthetic, disposable DB only. SQL session claims are NOT real JWTs.
begin;
create function pg_temp.ok(value boolean,label text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'FAIL: %',label; end if; raise notice 'ok - %',label; end $$;
create function pg_temp.denied(statement text,wanted text,label text) returns void language plpgsql as $$
declare code text; begin
 begin execute statement; exception when others then get stacked diagnostics code=returned_sqlstate; end;
 if code is distinct from wanted then raise exception 'FAIL: %, wanted %, got %',label,wanted,code; end if;
 raise notice 'ok - %',label;
end $$;
insert into auth.users(id) select ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid from generate_series(101,106)n;
set local role authenticated;
do $$ declare n integer; u uuid; begin
 for n in 101..106 loop
  u:=('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid;
  perform set_config('request.jwt.claim.sub',u::text,true);
  insert into public.profiles(display_name) values('Synthetic members A '||n);
  insert into public.players(name) values('Synthetic members A player '||n);
 end loop;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000101',true);
select public.create_group('Synthetic Members A','members-foundation-a') as ga \gset
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000102',true);
select public.create_group('Synthetic Members B','members-foundation-b') as gb \gset
reset role;
-- Privileged setup is not authorization evidence.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000101',true);
insert into public.group_members(group_id,player_id,role,status)
 select :'ga',id,case when user_id='00000000-0000-4000-8000-000000000104' then 'admin'
 when user_id='00000000-0000-4000-8000-000000000105' then 'guest' else 'player' end,'active'
 from public.players where user_id in ('00000000-0000-4000-8000-000000000103','00000000-0000-4000-8000-000000000104','00000000-0000-4000-8000-000000000105');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000102',true);
insert into public.group_members(group_id,player_id,role,status)
 select :'gb',id,'player','active' from public.players where user_id='00000000-0000-4000-8000-000000000103';
select id as pa from public.players where user_id='00000000-0000-4000-8000-000000000101' \gset
select id as pc from public.players where user_id='00000000-0000-4000-8000-000000000103' \gset
select id as pd from public.players where user_id='00000000-0000-4000-8000-000000000104' \gset
select id as pe from public.players where user_id='00000000-0000-4000-8000-000000000105' \gset
select id as mc from public.group_members where group_id=:'ga' and player_id=:'pc' \gset
select id as md from public.group_members where group_id=:'ga' and player_id=:'pd' \gset
select id as me from public.group_members where group_id=:'ga' and player_id=:'pe' \gset
select pg_temp.ok((select count(*)=3 from public.member_participation_periods where group_id=:'ga'),'one initial period per permanent member, none for guest');
select pg_temp.ok((select relrowsecurity from pg_class where oid='public.member_participation_periods'::regclass),'period RLS enabled');
select pg_temp.ok(not has_table_privilege('app_executor','auth.users','SELECT'),'executor gains no Auth access');
set session authorization authenticated;
select pg_temp.ok(current_user='authenticated' and session_user='authenticated','RLS executed as nonprivileged authenticated session');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000101',true);
select pg_temp.ok((select count(*)=1 from public.groups where id=:'ga'),'owner reads own group');
select pg_temp.ok((select count(*)=0 from public.groups where id=:'gb'),'owner cannot read foreign group');
select pg_temp.ok((select count(*)=3 from public.list_member_profiles(:'ga')),'projection lists permanent active members only');
select pg_temp.denied(format('select user_id from public.list_member_profiles(%L)',:'ga'),'42703','projection hides Auth identifiers');
select pg_temp.denied(format('select email from public.list_member_profiles(%L)',:'ga'),'42703','projection hides contacts');
select pg_temp.denied('select started_by from public.member_participation_periods','42501','period actor fields not exposed directly');
select pg_temp.denied(format('update public.member_participation_periods set ended_at=now() where member_id=%L',:'mc'),'42501','no direct period writes');
insert into public.venues(group_id,name) values(:'ga','Synthetic members venue') returning id as va \gset
insert into public.group_schedules(group_id,venue_id,weekday,starts_at_local,duration_minutes,recurrence_type,interval_weeks,starts_on)
 values(:'ga',:'va',1,'20:00',60,'weekly',1,'2030-01-07');
insert into public.group_pricing_policies(group_id,monthly_enabled,casual_enabled,effective_from)
 values(:'ga',false,false,current_date+1);
insert into public.matches(group_id,title,starts_at,ends_at,capacity)
 values(:'ga','Synthetic members preservation',now()+interval '10 days',now()+interval '10 days 1 hour',10) returning id as ma \gset
insert into public.match_attendance(group_id,match_id,player_id,status) values(:'ga',:'ma',:'pc','confirmed');
insert into public.member_billing_terms(group_id,player_id,billing_type,effective_from)
 values(:'ga',:'pc','monthly',current_date+1) returning id as term \gset
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000104',true);
select pg_temp.denied(format('select public.set_member_role(%L,%L,''admin'')',:'ga',:'mc'),'42501','admin cannot promote administrator');
select pg_temp.denied(format('select public.set_member_status(%L,%L,''suspended'')',:'ga',:'md'),'42501','admin cannot deactivate self');
select pg_temp.ok((select count(*)=1 from public.member_billing_terms where id=:'term'),'manager retains billing read');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000103',true);
select pg_temp.ok((select count(*)=3 from public.group_members where group_id=:'ga'),'player roster excludes guest');
select pg_temp.ok((select count(*)=1 from public.profiles),'profiles remain self-only');
select pg_temp.denied(format('select public.list_member_profiles(%L,''inactive'')',:'ga'),'42501','player cannot inspect inactive roster');
select pg_temp.ok((select count(*)=1 from public.member_billing_terms where id=:'term'),'player reads own classification');
select pg_temp.denied(format('select public.set_member_role(%L,%L,''admin'')',:'ga',:'mc'),'42501','player cannot self-promote');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000105',true);
select pg_temp.ok((select count(*)=0 from public.groups where id=:'ga'),'guest cannot read group');
select pg_temp.ok((select count(*)=0 from public.group_members where group_id=:'ga'),'guest cannot use old self-membership exception');
select pg_temp.ok((select count(*)=0 from public.member_participation_periods where group_id=:'ga'),'guest cannot read periods');
select pg_temp.ok((select count(*)=0 from public.matches where group_id=:'ga'),'guest cannot read private matches');
select pg_temp.ok((select count(*)=0 from public.venues where group_id=:'ga'),'guest cannot read private venues');
select pg_temp.ok((select count(*)=0 from public.group_schedules where group_id=:'ga'),'guest cannot read private schedules');
select pg_temp.ok((select count(*)=0 from public.group_pricing_policies where group_id=:'ga'),'guest cannot read private prices');
select pg_temp.ok((select count(*)=0 from public.match_attendance where group_id=:'ga'),'guest cannot read attendance');
select pg_temp.ok((select count(*)=0 from public.member_billing_terms where group_id=:'ga'),'guest cannot read billing');
select pg_temp.ok((select count(*)=0 from public.players where id=:'pc'),'guest cannot read another player');
select pg_temp.ok((select count(*)=1 from public.players where id=:'pe'),'guest retains own global identity');
select pg_temp.denied(format('select public.list_member_profiles(%L)',:'ga'),'42501','guest cannot bypass through roster RPC');
select pg_temp.denied(format('insert into public.match_attendance(group_id,match_id,player_id,status)values(%L,%L,%L,''confirmed'')',:'ga',:'ma',:'pe'),'42501','guest cannot enroll through legacy private attendance');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000102',true);
select pg_temp.ok((select count(*)=0 from public.member_participation_periods where group_id=:'ga'),'foreign owner cannot read periods');
select pg_temp.denied(format('select public.set_member_status(%L,%L,''suspended'')',:'ga',:'mc'),'42501','foreign owner cannot modify member');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000101',true);
select public.set_member_role(:'ga',:'mc','admin');
select public.set_member_role(:'ga',:'mc','player');
select pg_temp.ok((select count(*)=1 from public.member_participation_periods where member_id=:'mc'),'promotion preserves period');
select pg_temp.denied(format('select public.set_member_role(%L,%L,''admin'')',:'ga',:'me'),'23514','guest not promoted to administrator');
select public.set_member_status(:'ga',:'mc','suspended');
select pg_temp.ok((select count(*)=1 from public.member_participation_periods where member_id=:'mc' and ended_at is not null),'inactivation closes period once');
select pg_temp.ok((select count(*)=1 from public.match_attendance where match_id=:'ma' and player_id=:'pc'),'past attendance preserved');
select pg_temp.ok((select count(*)=1 from public.member_billing_terms where id=:'term' and billing_type='monthly' and effective_until is null),'financial history unchanged');
select pg_temp.denied(format('select public.set_member_status(%L,%L,''active'')',:'ga',:'mc'),'42501','legacy RPC cannot reactivate');
select set_config('app.membership_activation','1',true);
select pg_temp.denied(format('select public.set_member_status(%L,%L,''active'')',:'ga',:'mc'),'42501','caller GUC cannot authorize return');
select pg_temp.denied(format('update public.group_members set status=''active'' where id=%L',:'mc'),'42501','raw activation denied');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000103',true);
select pg_temp.ok((select count(*)=0 from public.groups where id=:'ga'),'inactive member loses group access');
select pg_temp.ok((select count(*)=0 from public.group_members where group_id=:'ga'),'inactive member loses roster access');
select pg_temp.ok((select count(*)=0 from public.member_participation_periods where group_id=:'ga'),'inactive member loses group period access');
select pg_temp.ok((select count(*)=1 from public.profiles),'inactive member retains own profile');
select pg_temp.ok((select count(*)=1 from public.groups where id=:'gb'),'inactivation preserves active access to another group');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000101',true);
select pg_temp.denied(format('select public.transfer_ownership(%L,%L)',:'ga',:'me'),'23514','guest cannot gain permanent ownership through transfer');
select pg_temp.ok(private.group_role(:'ga')='owner','failed guest transfer restores original owner');
select public.transfer_ownership(:'ga',:'md');
select pg_temp.ok(private.group_role(:'ga')='admin','legitimate transfer preserves existing owner-to-admin flow');
select pg_temp.ok((select count(*)=3 from public.member_participation_periods where group_id=:'ga'),'ownership transfer does not duplicate participation periods');
reset session authorization;
select pg_temp.ok((select count(*)=1 from public.group_members where group_id=:'ga' and role='owner' and status='active'),'unique owner preserved');
select pg_temp.denied(format('update public.member_participation_periods set started_at=started_at-interval ''1 day'' where member_id=%L',:'mc'),'42501','closed period immutable');
select pg_temp.denied(format('insert into public.member_participation_periods(group_id,member_id,player_id,started_at,source)values(%L,%L,%L,''2040-01-01'',''membership_created'')',:'gb',:'mc',:'pc'),'23503','composite FK forbids crossing groups');
select pg_temp.denied(format('insert into public.member_participation_periods(group_id,member_id,player_id,started_at,ended_at,source,end_reason)select group_id,member_id,player_id,started_at,clock_timestamp()+interval ''1 day'',''membership_created'',''inactive'' from public.member_participation_periods where group_id=%L and player_id=%L',:'ga',:'pa'),'23P01','period overlap rejected');
set session authorization anon;
select pg_temp.denied('select id from public.member_participation_periods','42501','anonymous periods denied');
reset session authorization;
set constraints all immediate;
rollback;
