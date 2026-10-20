-- Explicitly authorized development only. Always rolls back synthetic fixtures.
-- SQL role/claims tests, NOT Auth API or real JWT integration tests.
begin;
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid();
  ga uuid; gb uuid; pa uuid; pb uuid; ma uuid; mb uuid;
  va uuid; vb uuid; game uuid; attendance uuid;
  suffix text := replace(gen_random_uuid()::text, '-', '');
begin
  insert into auth.users(id) values (a), (b);
  set local role authenticated;
  perform set_config('request.jwt.claim.sub',a::text,true);
  insert into public.profiles(display_name) values ('Synthetic deployment A');
  ga := public.create_group('Synthetic deployment A','smoke-a-'||suffix);
  select id into pa from public.players where user_id=a;
  select id into ma from public.group_members where group_id=ga and player_id=pa;
  insert into public.venues(group_id,name) values (ga,'Synthetic venue A') returning id into va;
  insert into public.matches(group_id,venue_id,title,starts_at,ends_at,capacity)
    values (ga,va,'Synthetic deployment match',now()+interval '1 day',now()+interval '25 hours',2)
    returning id into game;
  perform set_config('request.jwt.claim.sub',b::text,true);
  insert into public.profiles(display_name) values ('Synthetic deployment B');
  gb := public.create_group('Synthetic deployment B','smoke-b-'||suffix);
  select id into pb from public.players where user_id=b;
  insert into public.venues(group_id,name) values (gb,'Synthetic venue B') returning id into vb;
  if (select count(*) from public.profiles)<>1 then raise exception 'Profile isolation failed'; end if;
  if exists(select 1 from public.groups where id=ga) then raise exception 'Tenant isolation failed'; end if;
  if exists(select 1 from public.players where id=pa) then raise exception 'Player privacy failed'; end if;
  begin
    perform public.list_invitations(ga);
    raise exception 'Cross tenant invitation list succeeded';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub',a::text,true);
  begin
    perform public.set_member_role(ga,ma,'admin');
    raise exception 'Owner demotion succeeded';
  exception when insufficient_privilege then null; end;
  begin
    perform public.set_member_status(ga,ma,'suspended');
    raise exception 'Owner suspension succeeded';
  exception when insufficient_privilege then null; end;
  begin
    perform 1 from public.group_invitations;
    raise exception 'Invitation hashes exposed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.matches(group_id,venue_id,title,starts_at,ends_at,capacity)
      values(ga,vb,'Cross tenant',now(),now()+interval '1 hour',2);
    raise exception 'Cross tenant venue accepted';
  exception when foreign_key_violation then null; end;
  begin
    insert into public.match_attendance(group_id,match_id,player_id,status) values(ga,game,pb,'confirmed');
    raise exception 'Ineligible player accepted';
  exception when check_violation then null; end;
  insert into public.match_attendance(group_id,match_id,player_id,status)
    values(ga,game,pa,'confirmed') returning id into attendance;
  begin
    insert into public.match_attendance(group_id,match_id,player_id,status) values(ga,game,pa,'confirmed');
    raise exception 'Duplicate attendance accepted';
  exception when unique_violation then null; end;
  reset role;
  insert into public.group_members(group_id,player_id,role) values(ga,pb,'player') returning id into mb;
  set local role authenticated;
  perform public.set_member_role(ga,mb,'admin');
  perform set_config('request.jwt.claim.sub',b::text,true);
  begin
    perform public.set_member_role(ga,mb,'owner');
    raise exception 'Self promotion succeeded';
  exception when insufficient_privilege then null; end;
  begin
    perform public.set_member_role(ga,ma,'player');
    raise exception 'Admin altered owner';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub',a::text,true);
  begin
    perform public.create_group('Duplicate slug','smoke-a-'||suffix);
    raise exception 'Duplicate group creation succeeded';
  exception when unique_violation then null; end;
  if (select count(*) from public.groups where created_by=a)<>1 then raise exception 'Atomic rollback failed'; end if;
  perform public.transfer_ownership(ga,mb);
  perform set_config('request.jwt.claim.sub',b::text,true);
  if (select count(*) from public.group_members where group_id=ga and role='owner' and status='active')<>1
    then raise exception 'Ownership invariant failed'; end if;
  set constraints all immediate;
  set local role anon;
  begin
    perform 1 from public.profiles;
    raise exception 'Anonymous profile access succeeded';
  exception when insufficient_privilege then null; end;
  reset role;
end $$;
select 'PASS: development SQL smoke; role/claims only; fixtures rolled back' as result;
rollback;
