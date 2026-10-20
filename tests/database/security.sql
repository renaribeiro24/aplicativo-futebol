\set ON_ERROR_STOP on
begin;
-- Resolve synthetic fixture identifiers before switching to authenticated.
select id as ga from public.groups where slug='test-alpha' \gset
select id as gb from public.groups where slug='test-beta' \gset
select id as va from public.venues where group_id=:'ga' \gset
select id as vb from public.venues where group_id=:'gb' \gset
select id as ma from public.matches where title='Synthetic match A' \gset
select id as limited from public.matches where title='Synthetic limited match' \gset
select id as pa from public.players where user_id='00000000-0000-4000-8000-000000000001' \gset
select id as pb from public.players where user_id='00000000-0000-4000-8000-000000000002' \gset
select id as pc from public.players where user_id='00000000-0000-4000-8000-000000000003' \gset
select id as pd from public.players where user_id='00000000-0000-4000-8000-000000000004' \gset
select id as pf from public.players where user_id='00000000-0000-4000-8000-000000000006' \gset
select id as guest from public.players where origin_group_id=:'ga' \gset
select id as owner_a from public.group_members where group_id=:'ga' and player_id=:'pa' \gset
select id as member_c from public.group_members where group_id=:'ga' and player_id=:'pc' \gset
select id as member_d from public.group_members where group_id=:'ga' and player_id=:'pd' \gset
select id as guest_member from public.group_members where group_id=:'ga' and player_id=:'guest' \gset

create function pg_temp.check_true(value boolean,label text) returns void language plpgsql security invoker as $$ begin
  if value is distinct from true then raise exception 'FAIL: %',label; end if;
  raise notice 'ok - %',label;
end $$;
create function pg_temp.expect_error(statement text,expected_state text,label text) returns void language plpgsql security invoker as $$ begin
  begin
    execute statement;
  exception when others then
    if sqlstate<>expected_state then raise exception 'FAIL: % expected %, got % (%)',label,expected_state,sqlstate,sqlerrm; end if;
    raise notice 'ok - %',label; return;
  end;
  raise exception 'FAIL: % unexpectedly succeeded',label;
end $$;

set session authorization authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
select pg_temp.check_true(current_user='authenticated','RLS tests run as authenticated, not service_role');
select pg_temp.check_true((select count(*)=8 from pg_class where relnamespace='public'::regnamespace and relname=any(array['profiles','players','groups','group_members','group_invitations','venues','matches','match_attendance']) and relrowsecurity),'all eight exposed tables have RLS');
select pg_temp.check_true((select count(*)=0 from public.groups where id=:'gb'),'A cannot read group B');
select pg_temp.check_true((select count(*)=0 from public.venues where group_id=:'gb'),'A cannot read B venues');
select pg_temp.check_true((select count(*)=0 from public.matches where group_id=:'gb'),'A cannot read B matches');
select pg_temp.check_true((select count(*)=0 from public.group_members where group_id=:'gb'),'A cannot read B roster');
select pg_temp.check_true((select count(*)=0 from public.players where id=:'pb'),'unshared global player is private');
select pg_temp.check_true((select count(*)=1 from public.profiles),'profiles are self-only');
update public.profiles set display_name='Updated self' where id=auth.uid();
select pg_temp.check_true((select display_name='Updated self' from public.profiles where id=auth.uid()),'user can update own profile');
with changed as (update public.profiles set display_name='Forbidden edit' where id='00000000-0000-4000-8000-000000000002' returning id)
select pg_temp.check_true((select count(*)=0 from changed),'RLS blocks editing another profile');
with changed as (update public.players set name='Forbidden global edit' where id=:'pc' returning id)
select pg_temp.check_true((select count(*)=0 from changed),'group owner cannot edit another linked global identity');
update public.players set nickname='Guest nickname' where id=:'guest';
select pg_temp.check_true((select nickname='Guest nickname' from public.players where id=:'guest'),'manager can edit a guest of the origin group');
select pg_temp.check_true((select not rolcanlogin and not rolsuper and not rolbypassrls from pg_roles where rolname='app_executor'),'definer role has no login, superuser or BYPASSRLS');
select pg_temp.check_true(not has_table_privilege('app_executor','auth.users','SELECT'),'definer role cannot read the Auth users table');
select pg_temp.check_true((select count(*)=0 from pg_proc where pronamespace='public'::regnamespace and prosecdef and (proname not in ('ensure_my_identity','save_my_identity','create_group_once','add_guest_once') or pg_get_userbyid(proowner)<>'app_executor' or proconfig is distinct from array['search_path=""']::text[] or has_function_privilege('anon',oid,'EXECUTE'))),'exposed definer routines limited to explicit authenticated application APIs');

select pg_temp.expect_error(format('update public.players set user_id=%L where id=%L','00000000-0000-4000-8000-000000000001',:'guest'),'42501','cannot claim a guest by changing user_id');
select pg_temp.expect_error(format('update public.venues set group_id=%L where id=%L',:'gb',:'va'),'42501','tenant identity is not client-editable');
select pg_temp.expect_error(format('update public.groups set created_by=%L where id=%L','00000000-0000-4000-8000-000000000002',:'ga'),'42501','creator identity is immutable to client');
select pg_temp.expect_error('set role app_executor','42501','client cannot assume definer role');
select pg_temp.expect_error(format('select private.require_manager(%L)',:'ga'),'42501','internal privileged helper is not client-callable');

select pg_temp.expect_error(format('insert into public.matches(group_id,venue_id,title,starts_at,ends_at,capacity) values(%L,%L,%L,now(),now()+interval ''1 hour'',10)',:'ga',:'vb','Cross tenant'),'23503','match rejects a venue belonging to B');
select pg_temp.expect_error(format('insert into public.matches(group_id,title,starts_at,ends_at,capacity) values(%L,%L,now(),now()-interval ''1 hour'',10)',:'ga','Invalid dates'),'23514','match dates are ordered');
select pg_temp.expect_error(format('insert into public.matches(group_id,title,starts_at,ends_at,capacity) values(%L,%L,now(),now()+interval ''1 hour'',0)',:'ga','Invalid capacity'),'23514','capacity must be positive');
select pg_temp.expect_error(format('update public.groups set timezone=%L where id=%L','Not/A_Timezone',:'ga'),'23514','invalid timezone rejected');
select pg_temp.expect_error(format('delete from public.group_members where id=%L',:'owner_a'),'42501','last owner cannot be deleted by client');
select pg_temp.expect_error(format('select public.set_member_status(%L,%L,%L)',:'ga',:'owner_a','suspended'),'42501','last owner cannot be suspended');
select pg_temp.expect_error(format('select public.set_member_role(%L,%L,%L)',:'ga',:'owner_a','player'),'42501','owner cannot demote self through generic role change');

select public.create_invitation(:'ga',repeat('a',64),'player',now()+interval '1 day',3) as invite \gset
select pg_temp.expect_error('select token_hash from public.group_invitations','42501','even owner cannot SELECT invitation hashes');
select pg_temp.check_true((select count(*)=1 from public.list_invitations(:'ga')),'owner can list sanitized invitation metadata');
select pg_temp.expect_error(format('select token_hash from public.list_invitations(%L)',:'ga'),'42703','sanitized RPC has no hash column');
select pg_temp.expect_error(format('select public.list_invitations(%L)',:'gb'),'42501','cannot list B invitations');
select pg_temp.expect_error(format('insert into public.match_attendance(group_id,match_id,player_id,status) values(%L,%L,%L,%L)',:'ga',:'ma',:'pb','confirmed'),'23514','attendance requires eligible group membership');
select public.set_member_status(:'ga',:'member_c','suspended');
select pg_temp.expect_error(format('insert into public.match_attendance(group_id,match_id,player_id,status) values(%L,%L,%L,%L)',:'ga',:'ma',:'pc','confirmed'),'23514','suspended player cannot be registered by admin');
select public.set_member_status(:'ga',:'member_c','active');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
select pg_temp.expect_error(format('select public.set_member_role(%L,%L,%L)',:'ga',:'member_c','admin'),'42501','player cannot promote self');
select pg_temp.expect_error(format('update public.group_members set role=%L where id=%L','owner',:'member_c'),'42501','raw role UPDATE is denied');
select pg_temp.expect_error(format('select public.list_invitations(%L)',:'ga'),'42501','player cannot list invitations');
insert into public.match_attendance(group_id,match_id,player_id,status) values(:'ga',:'ma',:'pc','confirmed');
select pg_temp.expect_error(format('insert into public.match_attendance(group_id,match_id,player_id,status) values(%L,%L,%L,%L)',:'ga',:'ma',:'pc','confirmed'),'23505','duplicate attendance rejected');
insert into public.match_attendance(group_id,match_id,player_id,status) values(:'ga',:'limited',:'pc','confirmed');
select pg_temp.expect_error(format('update public.match_attendance set player_id=%L where match_id=%L',:'pf',:'ma'),'42501','attendance identity cannot be reassigned');
select pg_temp.expect_error(format('insert into public.match_attendance(group_id,match_id,player_id,status) values(%L,%L,%L,%L)',:'gb',:'ma',:'pc','confirmed'),'23503','attendance cannot mix match and tenant');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000004',true);
select pg_temp.expect_error(format('select public.set_member_role(%L,%L,%L)',:'ga',:'owner_a','player'),'42501','administrator cannot change owner role');
select pg_temp.expect_error(format('select public.set_member_role(%L,%L,%L)',:'ga',:'member_d','owner'),'42501','administrator cannot become owner');
select pg_temp.expect_error(format('select public.set_member_status(%L,%L,%L)',:'ga',:'owner_a','left'),'42501','administrator cannot deactivate owner');
select pg_temp.expect_error(format('select public.transfer_ownership(%L,%L)',:'ga',:'member_d'),'42501','administrator cannot transfer ownership');
select pg_temp.expect_error(format('select public.create_invitation(%L,%L,%L,now()+interval ''1 day'',1)',:'ga',repeat('b',64),'admin'),'42501','administrator cannot invite another administrator');
select pg_temp.expect_error(format('insert into public.match_attendance(group_id,match_id,player_id,status) values(%L,%L,%L,%L)',:'ga',:'limited',:'pf','confirmed'),'23514','confirmed attendance cannot exceed capacity');
insert into public.match_attendance(group_id,match_id,player_id,status) values(:'ga',:'limited',:'pf','waitlisted');
select pg_temp.expect_error('select * from private.membership_events','42501','audit history is not exposed to clients');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000006',true);
select pg_temp.check_true((select count(*)=2 from public.groups),'one user can belong to both groups');
select pg_temp.expect_error(format('update public.venues set group_id=%L where id=%L',:'gb',:'va'),'42501','membership in A and B still cannot move tenant rows');
select pg_temp.check_true((select count(*)=0 from public.match_attendance where group_id=:'gb'),'B attendance contains no leaked A rows');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000005',true);
select pg_temp.check_true((select count(*)=0 from public.players),'outsider sees no sports identities');
select pg_temp.expect_error('select public.create_group(''Rollback test'',''test-alpha'')','23505','duplicate slug atomically aborts group creation');
select pg_temp.check_true((select count(*)=0 from public.players where user_id=auth.uid()),'failed create_group rolls back auto-created player');
select pg_temp.expect_error('select public.create_group(''Rollback zone'',''bad-zone'',null,''Invalid/Zone'')','23514','invalid timezone atomically aborts group creation');
select pg_temp.check_true((select count(*)=0 from public.players where user_id=auth.uid()),'invalid group also rolls back player creation');

select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
select pg_temp.expect_error(format('select public.transfer_ownership(%L,%L)',:'ga',:'guest_member'),'23514','unlinked guest cannot receive ownership');
select pg_temp.check_true(private.group_role(:'ga')='owner','failed ownership transfer preserves original owner');
reset session authorization;
create function pg_temp.reject_final_transfer() returns trigger language plpgsql as $$ begin
  raise exception 'Synthetic failure on final owner update' using errcode='23514';
end $$;
create trigger test_transfer_failure before update on public.group_members
for each row when (new.role='owner') execute function pg_temp.reject_final_transfer();
set session authorization authenticated;
select pg_temp.expect_error(format('select public.transfer_ownership(%L,%L)',:'ga',:'member_d'),'23514','failure after owner demotion rolls back the whole transfer');
select pg_temp.check_true(private.group_role(:'ga')='owner','late transfer failure restores old owner');
select pg_temp.check_true((select role='admin' from public.group_members where id=:'member_d'),'late failure leaves target unchanged');
reset session authorization;
drop trigger test_transfer_failure on public.group_members;
set session authorization authenticated;
select public.transfer_ownership(:'ga',:'member_d');
select pg_temp.check_true(private.group_role(:'ga')='admin','successful transfer demotes old owner to admin');
select pg_temp.check_true((select count(*)=1 from public.group_members where group_id=:'ga' and role='owner' and status='active'),'transfer leaves exactly one active owner');
select pg_temp.expect_error(format('select public.transfer_ownership(%L,%L)',:'ga',:'owner_a'),'42501','former owner cannot reclaim ownership');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000004',true);
select public.transfer_ownership(:'ga',:'owner_a');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
select public.set_member_status(:'ga',:'member_c','left');
select public.set_member_status(:'ga',:'member_c','active');
select pg_temp.check_true((select count(*)=1 from public.group_members where group_id=:'ga' and player_id=:'pc'),'reentry reuses membership instead of duplicating it');
select public.revoke_invitation(:'ga',:'invite');
select pg_temp.check_true((select revoked_at is not null from public.list_invitations(:'ga') where id=:'invite'),'invitation revocation is authorized and recorded');

reset session authorization;
set session authorization anon;
select pg_temp.expect_error('select * from public.groups','42501','anonymous role has no table access');
select pg_temp.expect_error('select public.create_group(''Anon'',''anon-group'')','42501','anonymous role cannot call administrative RPCs');
reset session authorization;
-- Defense-in-depth invariant tests are intentionally privileged, separate from RLS tests.
select pg_temp.expect_error(format('insert into public.group_members(group_id,player_id,role,status) values(%L,%L,''guest'',''active'')',:'gb',:'guest'),'23514','unlinked guest cannot be attached to a different origin group');
select pg_temp.expect_error(format('update public.group_members set role=''admin'' where id=%L; set constraints all immediate',:'owner_a'),'23514','deferred constraint rejects owner demotion even by table owner');
select pg_temp.expect_error(format('update public.players set deleted_at=now() where id=%L; set constraints all immediate',:'pa'),'23514','archiving a sole owner cannot orphan a group');
select pg_temp.check_true((select count(*)>=7 from private.membership_events where member_id=:'member_c' or member_id=:'owner_a' or member_id=:'member_d'),'membership changes preserve private audit history');
set constraints all immediate;
rollback;
