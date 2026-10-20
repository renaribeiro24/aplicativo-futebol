-- The NOLOGIN function owner bypasses RLS ONLY by owning these application tables.
-- It has no BYPASSRLS, login, membership in Supabase admin roles, or auth.users SELECT.
grant create on schema public to app_executor;
do $$ declare t text; f record; begin
  foreach t in array array['profiles','players','groups','group_members','group_invitations','venues','matches','match_attendance'] loop
    execute format('alter table public.%I owner to app_executor',t);
  end loop;
  alter table private.membership_events owner to app_executor;
  for f in select oid::regprocedure as signature from pg_proc where pronamespace='private'::regnamespace loop
    execute format('alter function %s owner to app_executor',f.signature);
  end loop;
end $$;
revoke create on schema public from app_executor;
revoke all on all functions in schema private from public, anon, authenticated, service_role;
grant usage on schema private to authenticated;
grant execute on function private.current_player_id(), private.group_role(uuid), private.can_read_player(uuid) to authenticated;
do $$ declare f record; begin
  for f in select oid::regprocedure as signature from pg_proc where pronamespace='private'::regnamespace and proname like '%\_impl' escape '\' loop
    execute format('grant execute on function %s to authenticated',f.signature);
  end loop;
  for f in select oid::regprocedure as signature from pg_proc where pronamespace='public'::regnamespace
    and proname=any(array['create_group','add_guest','set_member_role','set_member_status','transfer_ownership','create_invitation','list_invitations','revoke_invitation']) loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role',f.signature);
    execute format('grant execute on function %s to authenticated',f.signature);
  end loop;
end $$;

create policy profiles_read_self on public.profiles for select to authenticated using (id=(select auth.uid()));
create policy profiles_insert_self on public.profiles for insert to authenticated with check (id=(select auth.uid()));
create policy profiles_update_self on public.profiles for update to authenticated
  using (id=(select auth.uid())) with check (id=(select auth.uid()));
grant select on public.profiles to authenticated;
grant insert(display_name,avatar_url), update(display_name,avatar_url) on public.profiles to authenticated;

create policy players_read_authorized on public.players for select to authenticated
  using (deleted_at is null and private.can_read_player(id));
create policy players_insert_self on public.players for insert to authenticated
  with check (user_id=(select auth.uid()) and origin_group_id is null and created_by=(select auth.uid()) and deleted_at is null);
create policy players_update_authorized on public.players for update to authenticated
  using (deleted_at is null and (user_id=(select auth.uid()) or (user_id is null and private.group_role(origin_group_id) in ('owner','admin'))))
  with check (deleted_at is null and (user_id=(select auth.uid()) or (user_id is null and private.group_role(origin_group_id) in ('owner','admin'))));
grant select on public.players to authenticated;
grant insert(name,nickname,preferred_position,avatar_url), update(name,nickname,preferred_position,avatar_url) on public.players to authenticated;

create policy groups_read_member on public.groups for select to authenticated using (deleted_at is null and private.group_role(id) is not null);
create policy groups_update_manager on public.groups for update to authenticated
  using (deleted_at is null and private.group_role(id) in ('owner','admin'))
  with check (deleted_at is null and private.group_role(id) in ('owner','admin'));
grant select on public.groups to authenticated;
grant update(name,description,logo_url,timezone) on public.groups to authenticated;

create policy members_read_group_or_self on public.group_members for select to authenticated
  using (private.group_role(group_id) is not null or player_id=(select private.current_player_id()));
grant select on public.group_members to authenticated;
-- No direct membership writes. RPCs validate caller, lock tenant and restrict target role.
-- Invitations intentionally have no authenticated table privileges or policies.

create policy venues_read_member on public.venues for select to authenticated using (deleted_at is null and private.group_role(group_id) is not null);
create policy venues_insert_manager on public.venues for insert to authenticated with check (private.group_role(group_id) in ('owner','admin') and deleted_at is null);
create policy venues_update_manager on public.venues for update to authenticated
  using (private.group_role(group_id) in ('owner','admin') and deleted_at is null)
  with check (private.group_role(group_id) in ('owner','admin') and deleted_at is null);
grant select on public.venues to authenticated;
grant insert(group_id,name,address), update(name,address) on public.venues to authenticated;

create policy matches_read_member on public.matches for select to authenticated using (deleted_at is null and private.group_role(group_id) is not null);
create policy matches_insert_manager on public.matches for insert to authenticated
  with check (private.group_role(group_id) in ('owner','admin') and created_by=(select auth.uid()) and deleted_at is null);
create policy matches_update_manager on public.matches for update to authenticated
  using (private.group_role(group_id) in ('owner','admin') and deleted_at is null)
  with check (private.group_role(group_id) in ('owner','admin') and deleted_at is null);
grant select on public.matches to authenticated;
grant insert(group_id,venue_id,title,starts_at,ends_at,capacity,status), update(venue_id,title,starts_at,ends_at,capacity,status) on public.matches to authenticated;

create policy attendance_read_member on public.match_attendance for select to authenticated using (private.group_role(group_id) is not null);
create policy attendance_insert_self_or_manager on public.match_attendance for insert to authenticated
  with check (private.group_role(group_id) is not null and (player_id=(select private.current_player_id()) or private.group_role(group_id) in ('owner','admin')));
create policy attendance_update_self_or_manager on public.match_attendance for update to authenticated
  using (private.group_role(group_id) is not null and (player_id=(select private.current_player_id()) or private.group_role(group_id) in ('owner','admin')))
  with check (private.group_role(group_id) is not null and (player_id=(select private.current_player_id()) or private.group_role(group_id) in ('owner','admin')));
grant select on public.match_attendance to authenticated;
grant insert(group_id,match_id,player_id,status), update(status) on public.match_attendance to authenticated;
-- No physical DELETE privileges. Historical rows remain referenced.
