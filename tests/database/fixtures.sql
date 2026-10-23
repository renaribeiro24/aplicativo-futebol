-- Entirely synthetic data, only in the disposable local test container.
begin;
insert into auth.users(id) select ('00000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid from generate_series(1,6) n;
set local role authenticated;
do $$ declare n integer; u uuid; begin
  for n in 1..6 loop
    u:=('00000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid;
    perform set_config('request.jwt.claim.sub',u::text,true);
    insert into public.profiles(display_name) values('Synthetic account '||n);
    if n<>5 then insert into public.players(name) values('Synthetic player '||n); end if;
  end loop;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
select public.create_group('Synthetic Alpha','test-alpha') as ga \gset
select public.add_guest(:'ga','Synthetic guest') as guest_a \gset
insert into public.venues(group_id,name) values(:'ga','Synthetic venue A') returning id as va \gset
insert into public.matches(group_id,venue_id,title,starts_at,ends_at,capacity)
values(:'ga',:'va','Synthetic match A',now()+interval '1 day',now()+interval '1 day 1 hour',10) returning id as ma \gset
insert into public.matches(group_id,title,starts_at,ends_at,capacity)
values(:'ga','Synthetic limited match',now()+interval '2 days',now()+interval '2 days 1 hour',1) returning id as limited \gset
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
select public.create_group('Synthetic Beta','test-beta') as gb \gset
insert into public.venues(group_id,name) values(:'gb','Synthetic venue B') returning id as vb \gset
insert into public.matches(group_id,venue_id,title,starts_at,ends_at,capacity)
values(:'gb',:'vb','Synthetic match B',now()+interval '1 day',now()+interval '1 day 1 hour',10);
reset role;
-- Fixture seeding only. These INSERTs are NOT used to demonstrate client authorization.
insert into public.group_members(group_id,player_id,role,status)
select :'ga',id,case when user_id='00000000-0000-4000-8000-000000000004' then 'admin' else 'player' end,'active'
from public.players where user_id in ('00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000006');
insert into public.group_members(group_id,player_id,role,status)
select :'gb',id,'player','active' from public.players where user_id='00000000-0000-4000-8000-000000000006';
set constraints all immediate;
commit;
