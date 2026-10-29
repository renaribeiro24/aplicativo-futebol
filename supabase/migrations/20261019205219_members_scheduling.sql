create table public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete restrict,
  player_id uuid not null references public.players(id) on delete restrict,
  role text not null default 'player' check (role in ('owner','admin','player','guest')),
  status text not null default 'active' check (status in ('active','invited','suspended','left')),
  joined_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, player_id)
);
create unique index one_active_owner_per_group on public.group_members(group_id) where role='owner' and status='active';
create index group_members_player_group_idx on public.group_members(player_id, group_id) include (status, role);

create table public.group_invitations (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete restrict,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  role text not null check (role in ('admin','player','guest')),
  expires_at timestamptz not null,
  max_uses integer not null default 1 check (max_uses > 0),
  uses_count integer not null default 0 check (uses_count >= 0 and uses_count <= max_uses),
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz,
  check (expires_at > created_at),
  check (revoked_at is null or revoked_at >= created_at)
);
create index group_invitations_group_idx on public.group_invitations(group_id, expires_at);
create index group_invitations_created_by_idx on public.group_invitations(created_by);

create table public.venues (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  address text check (char_length(address) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (group_id, id)
);
create unique index venues_active_name_idx on public.venues(group_id, lower(btrim(name))) where deleted_at is null;

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete restrict,
  venue_id uuid,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity integer not null check (capacity > 0),
  status text not null default 'scheduled' check (status in ('scheduled','cancelled','completed')),
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (group_id, id),
  foreign key (group_id, venue_id) references public.venues(group_id, id) on delete restrict,
  check (ends_at > starts_at)
);
create index matches_group_date_idx on public.matches(group_id, starts_at desc) where deleted_at is null;
create index matches_group_venue_idx on public.matches(group_id, venue_id);
create index matches_created_by_idx on public.matches(created_by);

create table public.match_attendance (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete restrict,
  match_id uuid not null,
  player_id uuid not null,
  status text not null check (status in ('confirmed','waitlisted','declined','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (match_id, player_id),
  foreign key (group_id, match_id) references public.matches(group_id, id) on delete restrict,
  foreign key (group_id, player_id) references public.group_members(group_id, player_id) on delete restrict
);
create index match_attendance_group_match_status_idx on public.match_attendance(group_id, match_id, status);
create index match_attendance_group_player_idx on public.match_attendance(group_id, player_id);

create table private.membership_events (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.group_members(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete restrict,
  old_values jsonb,
  new_values jsonb not null,
  occurred_at timestamptz not null default clock_timestamp()
);
create index membership_events_member_date_idx on private.membership_events(member_id, occurred_at);
create index membership_events_actor_idx on private.membership_events(actor_user_id) where actor_user_id is not null;
alter table private.membership_events enable row level security;
revoke all on private.membership_events from public, anon, authenticated, service_role;

do $$ declare t text; begin
  foreach t in array array['group_members','group_invitations','venues','matches','match_attendance'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated, service_role', t);
  end loop;
end $$;
