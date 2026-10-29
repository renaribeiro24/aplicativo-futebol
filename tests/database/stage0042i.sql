\set ON_ERROR_STOP on
-- New disposable database only. Claims exercise PostgreSQL RLS, not Auth HTTP/JWT.
begin;
select id as ga from public.groups where slug='test-alpha' \gset
select id as gb from public.groups where slug='test-beta' \gset
-- Privileged fixture setup is separate from all authorization assertions.
insert into auth.users(id) values('00000000-0000-4000-8000-000000000008');
insert into public.players(user_id,name,created_by) values('00000000-0000-4000-8000-000000000008','Synthetic settings guest','00000000-0000-4000-8000-000000000008') returning id as pg \gset
insert into public.group_members(group_id,player_id,role) values(:'ga',:'pg','guest');
create function pg_temp.ok(value boolean,label text) returns void language plpgsql security invoker as $$ begin
  if value is distinct from true then raise exception 'FAIL: %',label; end if;
  raise notice 'ok - %',label;
end $$;
set session authorization authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
with changed as (update public.groups set name='Settings owner',description='Owner persisted',timezone='UTC' where id=:'ga' returning id)
select pg_temp.ok((select count(*)=1 from changed),'owner updates exactly one group');
select pg_temp.ok((select name='Settings owner' and description='Owner persisted' and timezone='UTC' from public.groups where id=:'ga'),'owner details persist on readback');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000004',true);
with changed as (update public.groups set name='Settings admin',description='Admin persisted',timezone='America/Sao_Paulo' where id=:'ga' returning id)
select pg_temp.ok((select count(*)=1 from changed),'admin updates exactly one group');
select pg_temp.ok((select name='Settings admin' and description='Admin persisted' and timezone='America/Sao_Paulo' from public.groups where id=:'ga'),'admin details persist on readback');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
with changed as (update public.groups set name='Forbidden player' where id=:'ga' returning id)
select pg_temp.ok((select count(*)=0 from changed),'player cannot edit group');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000008',true);
with changed as (update public.groups set name='Forbidden guest' where id=:'ga' returning id)
select pg_temp.ok((select count(*)=0 from changed),'guest cannot edit group');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
with changed as (update public.groups set name='Forbidden foreign owner' where id=:'ga' returning id)
select pg_temp.ok((select count(*)=0 from changed),'foreign owner cannot edit group A');
select pg_temp.ok((select name='Synthetic Beta' from public.groups where id=:'gb'),'foreign group unchanged');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
select pg_temp.ok((select name='Settings admin' and description='Admin persisted' from public.groups where id=:'ga'),'denials did not persist changes');
select pg_temp.ok((select count(*)=1 from public.group_members where group_id=:'ga' and role='owner' and status='active'),'original owner remains unique');
reset session authorization;
rollback;
