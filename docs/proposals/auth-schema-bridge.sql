-- PROPOSAL ONLY: not in supabase/migrations and not applied remotely.
-- Hosted auth schema grants cannot be delegated by the postgres migration role.
-- This narrow bridge returns only the caller identity from the official Auth helper.
create function private.auth_user_id() returns uuid
language sql stable security definer set search_path = ''
as $$ select auth.uid() $$;
alter function private.auth_user_id() owner to postgres;
revoke all on function private.auth_user_id() from public, anon, authenticated, service_role;
grant execute on function private.auth_user_id() to app_executor;

-- Preserve function definitions, owners and ACLs; replace only Auth helper calls.
do $$ declare f record; definition text; changed integer := 0; begin
  for f in select oid from pg_proc
    where pronamespace='private'::regnamespace
      and proname in ('current_player_id','group_role','can_read_player',
        'audit_membership','create_group_impl','add_guest_impl','create_invitation_impl')
  loop
    definition := pg_get_functiondef(f.oid);
    if position('auth.uid()' in definition)=0 then
      raise exception 'Unexpected function definition: %', f.oid::regprocedure;
    end if;
    execute replace(definition, 'auth.uid()', 'private.auth_user_id()');
    changed := changed + 1;
  end loop;
  if changed<>7 then raise exception 'Expected seven functions, found %',changed; end if;
end $$;
