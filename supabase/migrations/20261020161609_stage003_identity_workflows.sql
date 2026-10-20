-- Incremental onboarding and retry-safe mutations. Applied in one migration transaction.
-- No changes to the original six migrations or Auth schema permissions.
create table private.mutation_receipts (
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  request_id uuid not null,
  operation text not null check(operation in ('create_group','add_guest')),
  input_hash bytea not null,
  group_id uuid references public.groups(id) on delete restrict,
  result_id uuid,
  created_at timestamptz not null default now(),
  primary key(actor_user_id,request_id)
);
alter table private.mutation_receipts enable row level security;
alter table private.mutation_receipts owner to app_executor;
revoke all on private.mutation_receipts from public,anon,authenticated,service_role;
create index mutation_receipts_group_idx on private.mutation_receipts(group_id);

create function private.ensure_my_identity_impl(p_display_name text) returns uuid
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.auth_user_id(); player uuid; label text:=btrim(p_display_name);
begin
  if u is null then raise exception 'Autenticação necessária' using errcode='42501'; end if;
  if label is null or char_length(label) not between 1 and 100 then
    raise exception 'Nome inválido' using errcode='23514'; end if;
  insert into public.profiles(id,display_name) values(u,label) on conflict(id) do nothing;
  insert into public.players(user_id,name,created_by)
    select u,display_name,u from public.profiles where id=u on conflict(user_id) do nothing;
  select id into player from public.players where user_id=u and deleted_at is null;
  if player is null then raise exception 'Identidade indisponível' using errcode='23514'; end if;
  return player;
end $$;
create function private.save_my_identity_impl(p_display_name text,p_name text,p_nickname text,p_position text)
returns void language plpgsql security definer set search_path='' as $$
declare u uuid:=private.auth_user_id(); player uuid;
begin
  player:=private.ensure_my_identity_impl(p_display_name);
  update public.profiles set display_name=p_display_name where id=u;
  update public.players set name=p_name,nickname=nullif(p_nickname,''),preferred_position=nullif(p_position,'')
    where id=player and user_id=u and deleted_at is null;
end $$;
create function private.create_group_once_impl(p_request_id uuid,p_name text,p_slug text,p_description text,p_timezone text)
returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=private.auth_user_id(); h bytea; receipt private.mutation_receipts%rowtype; result uuid;
begin
  if u is null or p_request_id is null then raise exception 'Autenticação e requisição necessárias' using errcode='42501'; end if;
  h:=pg_catalog.sha256(pg_catalog.convert_to(jsonb_build_array(p_name,p_slug,p_description,p_timezone)::text,'UTF8'));
  insert into private.mutation_receipts(actor_user_id,request_id,operation,input_hash)
    values(u,p_request_id,'create_group',h) on conflict do nothing;
  select * into receipt from private.mutation_receipts where actor_user_id=u and request_id=p_request_id for update;
  if receipt.operation<>'create_group' or receipt.input_hash<>h then
    raise exception 'Requisição reutilizada com dados diferentes' using errcode='23514'; end if;
  if receipt.result_id is not null then
    if private.group_role(receipt.group_id) is null then raise exception 'Acesso indisponível' using errcode='42501'; end if;
    return receipt.result_id;
  end if;
  result:=private.create_group_impl(p_name,p_slug,p_description,p_timezone,null);
  update private.mutation_receipts set result_id=result,group_id=result where actor_user_id=u and request_id=p_request_id;
  return result;
end $$;
create function private.add_guest_once_impl(p_request_id uuid,p_group_id uuid,p_name text,p_nickname text,p_position text)
returns uuid language plpgsql security definer set search_path='' as $$
declare u uuid:=private.auth_user_id(); h bytea; receipt private.mutation_receipts%rowtype; result uuid;
begin
  -- Same lock order as the existing guest operation; authorize before returning receipts.
  perform private.require_manager(p_group_id);
  if u is null or p_request_id is null then raise exception 'Requisição inválida' using errcode='23514'; end if;
  h:=pg_catalog.sha256(pg_catalog.convert_to(jsonb_build_array(p_group_id,p_name,p_nickname,p_position)::text,'UTF8'));
  insert into private.mutation_receipts(actor_user_id,request_id,operation,input_hash,group_id)
    values(u,p_request_id,'add_guest',h,p_group_id) on conflict do nothing;
  select * into receipt from private.mutation_receipts where actor_user_id=u and request_id=p_request_id for update;
  if receipt.operation<>'add_guest' or receipt.input_hash<>h then
    raise exception 'Requisição reutilizada com dados diferentes' using errcode='23514'; end if;
  if receipt.result_id is not null then return receipt.result_id; end if;
  result:=private.add_guest_impl(p_group_id,p_name,nullif(p_nickname,''));
  update public.players set preferred_position=nullif(p_position,'')
    where id=result and user_id is null and origin_group_id=p_group_id;
  update private.mutation_receipts set result_id=result where actor_user_id=u and request_id=p_request_id;
  return result;
end $$;
-- New API boundaries run as the NOLOGIN application owner, not postgres/service_role.
-- No client receives EXECUTE on the new private implementations.
create function public.ensure_my_identity(p_display_name text) returns uuid
language plpgsql security definer set search_path='' as $$ begin
  if private.auth_user_id() is null then raise exception 'Autenticação necessária' using errcode='42501'; end if;
  return private.ensure_my_identity_impl(p_display_name);
end $$;
create function public.save_my_identity(p_display_name text,p_name text,p_nickname text,p_position text) returns void
language plpgsql security definer set search_path='' as $$ begin
  if private.auth_user_id() is null then raise exception 'Autenticação necessária' using errcode='42501'; end if;
  perform private.save_my_identity_impl(p_display_name,p_name,p_nickname,p_position);
end $$;
create function public.create_group_once(p_request_id uuid,p_name text,p_slug text,p_description text,p_timezone text) returns uuid
language plpgsql security definer set search_path='' as $$ begin
  if private.auth_user_id() is null then raise exception 'Autenticação necessária' using errcode='42501'; end if;
  return private.create_group_once_impl(p_request_id,p_name,p_slug,p_description,p_timezone);
end $$;
create function public.add_guest_once(p_request_id uuid,p_group_id uuid,p_name text,p_nickname text,p_position text) returns uuid
language plpgsql security definer set search_path='' as $$ begin
  if private.auth_user_id() is null then raise exception 'Autenticação necessária' using errcode='42501'; end if;
  return private.add_guest_once_impl(p_request_id,p_group_id,p_name,p_nickname,p_position);
end $$;
-- Explicit signatures and ownership; no grant to API clients on the receipt table.
alter function private.ensure_my_identity_impl(text) owner to app_executor;
alter function private.save_my_identity_impl(text,text,text,text) owner to app_executor;
alter function private.create_group_once_impl(uuid,text,text,text,text) owner to app_executor;
alter function private.add_guest_once_impl(uuid,uuid,text,text,text) owner to app_executor;
-- Managed postgres requires target owner CREATE for ownership transfer.
-- Temporary inside the migration transaction; NOLOGIN executor has no client members.
grant create on schema public to app_executor;
alter function public.ensure_my_identity(text) owner to app_executor;
alter function public.save_my_identity(text,text,text,text) owner to app_executor;
alter function public.create_group_once(uuid,text,text,text,text) owner to app_executor;
alter function public.add_guest_once(uuid,uuid,text,text,text) owner to app_executor;
revoke create on schema public from app_executor;
revoke all on function private.ensure_my_identity_impl(text),private.save_my_identity_impl(text,text,text,text),
  private.create_group_once_impl(uuid,text,text,text,text),private.add_guest_once_impl(uuid,uuid,text,text,text),
  public.ensure_my_identity(text),public.save_my_identity(text,text,text,text),
  public.create_group_once(uuid,text,text,text,text),public.add_guest_once(uuid,uuid,text,text,text)
  from public,anon,authenticated,service_role;
grant execute on function public.ensure_my_identity(text),public.save_my_identity(text,text,text,text),
  public.create_group_once(uuid,text,text,text,text),public.add_guest_once(uuid,uuid,text,text,text) to authenticated;
