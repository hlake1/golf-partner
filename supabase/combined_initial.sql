-- ========================================================================
-- Golf Partner - Initial Schema
-- MVP feature spec (2026-07-17):
--   - Profiles: photo, handicap, age, clubs, style, drink-after, occupation
--   - Discovery: local players, radius filter, club filter
--   - Rounds: hosted future rounds, join requests
--   - Chat: 1-to-1 messaging
--   - Notifications: push notification records
-- ========================================================================

-- Extensions we need
create extension if not exists "pgcrypto";
create extension if not exists "postgis"; -- for geographic distance queries

-- ========================================================================
-- 1. GOLF CLUBS (reference table, seeded with UK clubs)
-- ========================================================================
create table if not exists public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  website text,
  location geography(point, 4326) not null, -- lng/lat as PostGIS point
  county text,
  country text default 'UK',
  created_at timestamptz not null default now()
);

create index clubs_location_idx on public.clubs using gist (location);
create index clubs_name_idx on public.clubs (name);

-- ========================================================================
-- 2. USER PROFILES (extends auth.users)
-- ========================================================================
-- Playing style enum
do $$ begin
  create type public.playing_style as enum ('competitive', 'casual');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  photo_url text,
  handicap numeric(4,1), -- e.g. 12.5 (English Golf Union allows decimals)
  age int check (age >= 13 and age <= 120), -- 13+ for legal compliance
  playing_style public.playing_style not null default 'casual',
  up_for_drink_afterwards boolean not null default false,
  occupation text, -- optional networking field
  home_location geography(point, 4326), -- for "local players" queries
  search_radius_miles int not null default 10 check (search_radius_miles > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_home_location_idx on public.profiles using gist (home_location);

-- Auto-update updated_at
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ========================================================================
-- 3. USER <-> CLUB MEMBERSHIPS (many-to-many)
-- ========================================================================
create table if not exists public.profile_clubs (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, club_id)
);

create index profile_clubs_profile_idx on public.profile_clubs (profile_id);
create index profile_clubs_club_idx on public.profile_clubs (club_id);

-- ========================================================================
-- 4. ROUNDS (planned games, calendar feature)
-- ========================================================================
do $$ begin
  create type public.round_status as enum ('open', 'full', 'completed', 'cancelled');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.rounds (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(id) on delete cascade,
  club_id uuid not null references public.clubs(id) on delete restrict,
  scheduled_for timestamptz not null,
  players_needed int not null default 1 check (players_needed >= 1 and players_needed <= 3),
  notes text,
  status public.round_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index rounds_host_idx on public.rounds (host_id);
create index rounds_club_idx on public.rounds (club_id);
create index rounds_scheduled_idx on public.rounds (scheduled_for);
create index rounds_status_idx on public.rounds (status);

create trigger rounds_touch_updated_at
  before update on public.rounds
  for each row execute function public.touch_updated_at();

-- ========================================================================
-- 5. JOIN REQUESTS (users asking to join a round)
-- ========================================================================
do $$ begin
  create type public.join_request_status as enum ('pending', 'accepted', 'declined', 'withdrawn');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.join_requests (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds(id) on delete cascade,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  status public.join_request_status not null default 'pending',
  message text, -- optional intro message
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (round_id, requester_id) -- one request per user per round
);

create index join_requests_round_idx on public.join_requests (round_id);
create index join_requests_requester_idx on public.join_requests (requester_id);
create index join_requests_status_idx on public.join_requests (status);

-- ========================================================================
-- 6. CONVERSATIONS + MESSAGES (chat)
-- ========================================================================
-- A conversation is between exactly two users.
-- Conversations are created when someone hits "Invite to a Round" or a join request is accepted.
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid not null references public.profiles(id) on delete cascade,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  -- enforce user_a < user_b so we don't get duplicate pairs
  check (user_a < user_b),
  unique (user_a, user_b)
);

create index conversations_user_a_idx on public.conversations (user_a);
create index conversations_user_b_idx on public.conversations (user_b);
create index conversations_last_message_idx on public.conversations (last_message_at desc);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (length(content) between 1 and 4000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index messages_conversation_idx on public.messages (conversation_id, created_at desc);
create index messages_sender_idx on public.messages (sender_id);

-- Keep conversation.last_message_at fresh
create or replace function public.bump_conversation_last_message()
returns trigger
language plpgsql
as $$
begin
  update public.conversations
     set last_message_at = new.created_at
   where id = new.conversation_id;
  return new;
end;
$$;

create trigger messages_bump_conversation
  after insert on public.messages
  for each row execute function public.bump_conversation_last_message();

-- ========================================================================
-- 7. NOTIFICATIONS (in-app + push notification records)
-- ========================================================================
do $$ begin
  create type public.notification_type as enum (
    'join_request',     -- someone asked to join your round
    'request_accepted', -- your join request was accepted
    'request_declined', -- your join request was declined
    'new_message',      -- new chat message
    'round_reminder'    -- upcoming round reminder
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type public.notification_type not null,
  title text not null,
  body text not null,
  data jsonb, -- e.g. { round_id, requester_id, conversation_id }
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read_at is null;

-- ========================================================================
-- 8. PUSH TOKENS (Expo push notification tokens per device)
-- ========================================================================
create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  expo_push_token text not null,
  device_info jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, expo_push_token)
);

create index push_tokens_user_idx on public.push_tokens (user_id);

-- ========================================================================
-- 9. AUTO-CREATE PROFILE ON SIGNUP
-- ========================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'Golfer')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
-- ========================================================================
-- Row Level Security (RLS) - lock down who can read/write what
-- ========================================================================

-- Enable RLS on all user-facing tables
alter table public.clubs enable row level security;
alter table public.profiles enable row level security;
alter table public.profile_clubs enable row level security;
alter table public.rounds enable row level security;
alter table public.join_requests enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.push_tokens enable row level security;

-- ========================================================================
-- CLUBS: public read (anyone signed in can see all clubs), no writes from client
-- ========================================================================
create policy "Clubs are viewable by everyone"
  on public.clubs for select
  using (true);

-- ========================================================================
-- PROFILES: anyone signed in can read profiles (needed for discovery);
-- users can only update their own profile
-- ========================================================================
create policy "Profiles are viewable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Users can insert their own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ========================================================================
-- PROFILE_CLUBS: readable by all authenticated (for filtering by club);
-- users manage their own membership rows
-- ========================================================================
create policy "Profile-club links are viewable by authenticated users"
  on public.profile_clubs for select
  to authenticated
  using (true);

create policy "Users can add their own club memberships"
  on public.profile_clubs for insert
  to authenticated
  with check (auth.uid() = profile_id);

create policy "Users can remove their own club memberships"
  on public.profile_clubs for delete
  to authenticated
  using (auth.uid() = profile_id);

-- ========================================================================
-- ROUNDS: viewable by all authenticated (calendar discovery);
-- host manages their own rounds
-- ========================================================================
create policy "Rounds are viewable by authenticated users"
  on public.rounds for select
  to authenticated
  using (true);

create policy "Users can host their own rounds"
  on public.rounds for insert
  to authenticated
  with check (auth.uid() = host_id);

create policy "Hosts can update their own rounds"
  on public.rounds for update
  to authenticated
  using (auth.uid() = host_id)
  with check (auth.uid() = host_id);

create policy "Hosts can delete their own rounds"
  on public.rounds for delete
  to authenticated
  using (auth.uid() = host_id);

-- ========================================================================
-- JOIN_REQUESTS:
--   - Requester can see their own requests
--   - Host of the round can see all requests for their round
--   - Requester creates their own requests
--   - Host and requester can update (accept/decline/withdraw)
-- ========================================================================
create policy "Users can see their own requests and requests to their rounds"
  on public.join_requests for select
  to authenticated
  using (
    auth.uid() = requester_id
    or auth.uid() in (select host_id from public.rounds where id = round_id)
  );

create policy "Users can request to join a round"
  on public.join_requests for insert
  to authenticated
  with check (auth.uid() = requester_id);

create policy "Requesters can withdraw and hosts can respond"
  on public.join_requests for update
  to authenticated
  using (
    auth.uid() = requester_id
    or auth.uid() in (select host_id from public.rounds where id = round_id)
  );

-- ========================================================================
-- CONVERSATIONS: only the two participants can see or modify
-- ========================================================================
create policy "Users can see their own conversations"
  on public.conversations for select
  to authenticated
  using (auth.uid() = user_a or auth.uid() = user_b);

create policy "Users can create conversations they participate in"
  on public.conversations for insert
  to authenticated
  with check (auth.uid() = user_a or auth.uid() = user_b);

-- ========================================================================
-- MESSAGES: only participants of the conversation can read;
-- only sender can insert
-- ========================================================================
create policy "Participants can read messages"
  on public.messages for select
  to authenticated
  using (
    auth.uid() in (
      select user_a from public.conversations where id = conversation_id
      union all
      select user_b from public.conversations where id = conversation_id
    )
  );

create policy "Participants can send messages"
  on public.messages for insert
  to authenticated
  with check (
    auth.uid() = sender_id
    and auth.uid() in (
      select user_a from public.conversations where id = conversation_id
      union all
      select user_b from public.conversations where id = conversation_id
    )
  );

create policy "Receivers can mark messages as read"
  on public.messages for update
  to authenticated
  using (
    auth.uid() in (
      select user_a from public.conversations where id = conversation_id
      union all
      select user_b from public.conversations where id = conversation_id
    )
    and auth.uid() != sender_id -- only receivers, not senders
  );

-- ========================================================================
-- NOTIFICATIONS: users only see their own
-- ========================================================================
create policy "Users can see their own notifications"
  on public.notifications for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can mark their notifications as read"
  on public.notifications for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- NOTE: notifications are inserted by server-side functions (via triggers), not clients.

-- ========================================================================
-- PUSH_TOKENS: users only see and modify their own
-- ========================================================================
create policy "Users can see their own push tokens"
  on public.push_tokens for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can register their own push tokens"
  on public.push_tokens for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can remove their own push tokens"
  on public.push_tokens for delete
  to authenticated
  using (auth.uid() = user_id);
-- ========================================================================
-- RPC functions for discovery queries (local players, nearby courses)
-- ========================================================================

-- Find players within a radius of a location, with optional club filter
create or replace function public.nearby_players(
  origin_lng double precision,
  origin_lat double precision,
  radius_miles double precision,
  club_filter uuid default null
)
returns table (
  id uuid,
  full_name text,
  photo_url text,
  handicap numeric,
  age int,
  playing_style public.playing_style,
  up_for_drink_afterwards boolean,
  occupation text,
  distance_miles double precision,
  clubs jsonb
)
language sql
security invoker
stable
as $$
  with origin as (
    select st_makepoint(origin_lng, origin_lat)::geography as pt
  )
  select
    p.id,
    p.full_name,
    p.photo_url,
    p.handicap,
    p.age,
    p.playing_style,
    p.up_for_drink_afterwards,
    p.occupation,
    (st_distance(p.home_location, o.pt) / 1609.344)::double precision as distance_miles,
    coalesce(
      (
        select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name))
        from public.profile_clubs pc
        join public.clubs c on c.id = pc.club_id
        where pc.profile_id = p.id
      ),
      '[]'::jsonb
    ) as clubs
  from public.profiles p, origin o
  where p.id != auth.uid() -- exclude self
    and p.home_location is not null
    and st_dwithin(p.home_location, o.pt, radius_miles * 1609.344)
    and (
      club_filter is null
      or exists (
        select 1 from public.profile_clubs pc
        where pc.profile_id = p.id and pc.club_id = club_filter
      )
    )
  order by distance_miles asc
  limit 100;
$$;

-- Find golf courses within a radius
create or replace function public.nearby_clubs(
  origin_lng double precision,
  origin_lat double precision,
  radius_miles double precision
)
returns table (
  id uuid,
  name text,
  address text,
  website text,
  latitude double precision,
  longitude double precision,
  distance_miles double precision
)
language sql
security invoker
stable
as $$
  with origin as (
    select st_makepoint(origin_lng, origin_lat)::geography as pt
  )
  select
    c.id,
    c.name,
    c.address,
    c.website,
    st_y(c.location::geometry) as latitude,
    st_x(c.location::geometry) as longitude,
    (st_distance(c.location, o.pt) / 1609.344)::double precision as distance_miles
  from public.clubs c, origin o
  where st_dwithin(c.location, o.pt, radius_miles * 1609.344)
  order by distance_miles asc
  limit 200;
$$;

-- Helper: get or create a conversation between two users
create or replace function public.get_or_create_conversation(other_user_id uuid)
returns uuid
language plpgsql
security invoker
as $$
declare
  me uuid := auth.uid();
  a uuid;
  b uuid;
  conv_id uuid;
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;
  if me = other_user_id then
    raise exception 'Cannot start a conversation with yourself';
  end if;

  -- Order the two ids so user_a < user_b (matches table constraint)
  if me < other_user_id then
    a := me; b := other_user_id;
  else
    a := other_user_id; b := me;
  end if;

  select id into conv_id from public.conversations where user_a = a and user_b = b;

  if conv_id is null then
    insert into public.conversations (user_a, user_b)
    values (a, b)
    returning id into conv_id;
  end if;

  return conv_id;
end;
$$;
-- ========================================================================
-- Seed some UK golf clubs (Oxfordshire focus for Herbie's testing)
-- Coordinates are approximate; will get refined later.
-- Format: st_makepoint(LONGITUDE, LATITUDE)::geography
-- ========================================================================

insert into public.clubs (name, address, website, county, location) values
  ('Frilford Heath Golf Club', 'Frilford Heath, Abingdon OX13 5NW', 'https://www.frilfordheath.co.uk', 'Oxfordshire',
    st_makepoint(-1.3577, 51.6797)::geography),
  ('The Oxfordshire Golf Club', 'Rycote Ln, Milton Common OX9 2PU', 'https://www.theoxfordshiregolfclub.com', 'Oxfordshire',
    st_makepoint(-1.0619, 51.7297)::geography),
  ('Studley Wood Golf Club', 'The Straight Mile, Horton-cum-Studley OX33 1BF', 'https://www.studleywoodgolf.co.uk', 'Oxfordshire',
    st_makepoint(-1.1236, 51.8181)::geography),
  ('Hinksey Heights Golf Club', 'South Hinksey, Oxford OX1 5AB', 'https://www.oxford-golf.co.uk', 'Oxfordshire',
    st_makepoint(-1.2731, 51.7297)::geography),
  ('Tadmarton Heath Golf Club', 'Wigginton, Banbury OX15 5HL', 'https://www.tadmartongolf.com', 'Oxfordshire',
    st_makepoint(-1.4650, 51.9631)::geography),
  ('Burford Golf Club', 'Swindon Rd, Burford OX18 4JG', 'https://www.burfordgolfclub.co.uk', 'Oxfordshire',
    st_makepoint(-1.6408, 51.8058)::geography),
  ('Chipping Norton Golf Club', 'Southcombe, Chipping Norton OX7 5QH', 'https://www.chippingnortongolfclub.com', 'Oxfordshire',
    st_makepoint(-1.5292, 51.9339)::geography),
  ('Huntercombe Golf Club', 'Nuffield, Henley-on-Thames RG9 5SL', 'https://www.huntercombegolfclub.co.uk', 'Oxfordshire',
    st_makepoint(-1.0500, 51.5867)::geography),
  ('Waterstock Golf Club', 'Thame Rd, Waterstock OX33 1HT', 'https://www.waterstockgolf.co.uk', 'Oxfordshire',
    st_makepoint(-1.1069, 51.7519)::geography),
  ('Drayton Park Golf Club', 'Steventon Rd, Drayton OX14 4LA', 'https://www.draytonparkgolfclub.co.uk', 'Oxfordshire',
    st_makepoint(-1.3153, 51.6431)::geography),
  ('North Oxford Golf Club', 'Banbury Rd, Oxford OX2 8EZ', 'https://www.nogc.co.uk', 'Oxfordshire',
    st_makepoint(-1.2597, 51.7756)::geography),
  ('Southfield Golf Club', 'Hill Top Rd, Oxford OX4 1PF', 'https://www.southfieldgolf.com', 'Oxfordshire',
    st_makepoint(-1.2264, 51.7411)::geography),
  ('Witney Lakes Golf Club', 'Downs Rd, Witney OX29 0SY', 'https://www.witney-lakes.co.uk', 'Oxfordshire',
    st_makepoint(-1.5300, 51.7861)::geography),
  ('The Springs Golf Club', 'Wallingford Rd, North Stoke OX10 6BE', 'https://www.thespringshotel.co.uk/golf', 'Oxfordshire',
    st_makepoint(-1.1181, 51.5931)::geography),
  ('Badgemore Park Golf Club', 'Badgemore, Henley-on-Thames RG9 4NR', 'https://www.badgemorepark.com', 'Oxfordshire',
    st_makepoint(-0.9147, 51.5528)::geography)
on conflict do nothing;
