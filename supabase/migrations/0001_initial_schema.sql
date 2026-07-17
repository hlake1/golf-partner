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
