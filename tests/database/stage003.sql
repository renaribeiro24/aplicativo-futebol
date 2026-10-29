-- Synthetic SQL integration only; not Auth HTTP/JWT. Everything is rolled back.
begin;
do $$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); pa uuid; pb uuid;
  g uuid; guest uuid; request_group uuid:=gen_random_uuid(); request_guest uuid:=gen_random_uuid();
  slug text:='stage003-'||replace(gen_random_uuid()::text,'-','');
begin
  insert into auth.users(id) values(a),(b);
  set local role authenticated;
  perform set_config('request.jwt.claim.sub',a::text,true);
  begin
    perform private.ensure_my_identity_impl('Forbidden direct access');
    raise exception 'New private implementation exposed';
  exception when insufficient_privilege then null; end;
  pa:=public.ensure_my_identity('Synthetic onboarding A');
  if public.ensure_my_identity('Do not overwrite')<>pa then raise exception 'Identity duplicated'; end if;
  if (select display_name from public.profiles where id=a)<>'Synthetic onboarding A' then raise exception 'Profile overwritten'; end if;
  g:=public.create_group_once(request_group,'Synthetic group',slug,'Description','America/Sao_Paulo');
  if public.create_group_once(request_group,'Synthetic group',slug,'Description','America/Sao_Paulo')<>g then raise exception 'Group duplicated'; end if;
  if (select count(*) from public.group_members where group_id=g and role='owner' and status='active')<>1 then raise exception 'Initial owner invalid'; end if;
  guest:=public.add_guest_once(request_guest,g,'Synthetic guest','Nickname','defender');
  if public.add_guest_once(request_guest,g,'Synthetic guest','Nickname','defender')<>guest then raise exception 'Guest duplicated'; end if;
  if (select preferred_position from public.players where id=guest)<>'defender' then raise exception 'Position not saved'; end if;
  begin
    perform public.add_guest_once(request_guest,g,'Different guest','','');
    raise exception 'Reused request accepted different payload';
  exception when check_violation then null; end;
  begin
    perform public.create_group_once(gen_random_uuid(),'Duplicate',slug,'','America/Sao_Paulo');
    raise exception 'Duplicate slug accepted';
  exception when unique_violation then null; end;
  perform public.save_my_identity('Display updated','Sport updated','Nickname','forward');
  begin
    perform public.save_my_identity('Must rollback','Sport updated','','invalid-position');
    raise exception 'Invalid profile update accepted';
  exception when check_violation then null; end;
  if (select display_name from public.profiles where id=a)<>'Display updated' then raise exception 'Partial profile update committed'; end if;
  begin
    perform 1 from private.mutation_receipts;
    raise exception 'Receipts exposed';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub',b::text,true);
  pb:=public.ensure_my_identity('Synthetic onboarding B');
  if pa=pb or exists(select 1 from public.groups where id=g) then raise exception 'Tenant leak'; end if;
  begin
    perform public.add_guest_once(gen_random_uuid(),g,'Intruder','','');
    raise exception 'Unauthorized admin operation accepted';
  exception when insufficient_privilege then null; end;
  if exists(select 1 from public.players where id=pa) then raise exception 'Global identity leaked'; end if;
  reset role;
  if (select count(*) from private.mutation_receipts where actor_user_id=a)<>2 then raise exception 'Receipt rollback failed'; end if;
  set local role anon;
  begin
    perform public.ensure_my_identity('Anonymous');
    raise exception 'Anonymous onboarding accepted';
  exception when insufficient_privilege then null; end;
  reset role;
  set constraints all immediate;
end $$;
select 'PASS: stage003 identity, groups, guests, idempotency, isolation and rollback; SQL only' as result;
rollback;
