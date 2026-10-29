-- Identity and tenant foundation. No seed data or remote operations.
create role app_executor nologin noinherit nobypassrls;
-- Only the trusted Supabase migration administrator may SET the technical owner role.
grant app_executor to postgres;
create schema private authorization app_executor;
revoke all on schema private from public, anon, authenticated, service_role;
grant usage on schema public, auth to app_executor;
grant execute on function auth.uid() to app_executor;

create table public.profiles (
  id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 100),
  avatar_url text check (avatar_url is null or (char_length(avatar_url) <= 2048 and avatar_url ~ '^https://')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.players (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique default auth.uid() references auth.users(id) on delete restrict,
  origin_group_id uuid,
  name text not null check (char_length(btrim(name)) between 1 and 100),
  nickname text check (char_length(nickname) <= 60),
  preferred_position text check (preferred_position in ('goalkeeper','defender','midfielder','forward')),
  avatar_url text check (avatar_url is null or (char_length(avatar_url) <= 2048 and avatar_url ~ '^https://')),
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint player_identity_scope check (
    (user_id is not null and origin_group_id is null) or
    (user_id is null and origin_group_id is not null)
  )
);
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 100),
  slug text not null unique check (char_length(slug) between 3 and 64 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text check (char_length(description) <= 1000),
  logo_url text check (logo_url is null or (char_length(logo_url) <= 2048 and logo_url ~ '^https://')),
  timezone text not null default 'America/Sao_Paulo',
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
alter table public.players add constraint players_origin_group_fk foreign key (origin_group_id) references public.groups(id) on delete restrict;
create index players_origin_group_idx on public.players(origin_group_id) where origin_group_id is not null;
create index players_created_by_idx on public.players(created_by);
create index groups_created_by_idx on public.groups(created_by);

alter table public.profiles enable row level security;
alter table public.players enable row level security;
alter table public.groups enable row level security;
revoke all on public.profiles, public.players, public.groups from public, anon, authenticated, service_role;
