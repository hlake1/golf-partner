-- ========================================================================
-- Friends system
--
-- Two tables:
--   friendships     - the confirmed mutual relationship (symmetric via user_a < user_b)
--   friend_requests - one-way pending requests until accepted/declined
--
-- Auto-friend trigger: when a join_request flips to 'accepted',
-- create a friendship between host and requester automatically.
-- ========================================================================

-- ---- friendships (mutual, one row per pair) ----
create table if not exists public.friendships (
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  origin text not null default 'friend_request', -- 'friend_request' | 'round_accept'
  primary key (user_a, user_b),
  check (user_a < user_b) -- enforce canonical ordering
);

create index friendships_user_a_idx on public.friendships (user_a);
create index friendships_user_b_idx on public.friendships (user_b);

-- ---- friend_requests (one-way, until responded to) ----
do $$ begin
  create type public.friend_request_status as enum ('pending', 'accepted', 'declined', 'cancelled');
exception when duplicate_object then null; end $$;

create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  status public.friend_request_status not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (requester_id != recipient_id),
  -- only one pending request per pair at a time (partial unique)
  unique (requester_id, recipient_id)
);

create index friend_requests_requester_idx on public.friend_requests (requester_id);
create index friend_requests_recipient_idx on public.friend_requests (recipient_id);
create index friend_requests_pending_idx on public.friend_requests (recipient_id) where status = 'pending';

-- ---- RLS ----
alter table public.friendships enable row level security;
alter table public.friend_requests enable row level security;

-- Friendships: both participants can see; nobody can insert directly (only via RPC/trigger)
drop policy if exists "Friendships visible to participants" on public.friendships;
create policy "Friendships visible to participants"
  on public.friendships for select
  to authenticated
  using (auth.uid() = user_a or auth.uid() = user_b);

drop policy if exists "Users can unfriend themselves" on public.friendships;
create policy "Users can unfriend themselves"
  on public.friendships for delete
  to authenticated
  using (auth.uid() = user_a or auth.uid() = user_b);

-- Friend requests: participants can see; requester can create/cancel;
-- recipient can update (accept/decline)
drop policy if exists "Friend requests visible to participants" on public.friend_requests;
create policy "Friend requests visible to participants"
  on public.friend_requests for select
  to authenticated
  using (auth.uid() = requester_id or auth.uid() = recipient_id);

drop policy if exists "Users can send friend requests" on public.friend_requests;
create policy "Users can send friend requests"
  on public.friend_requests for insert
  to authenticated
  with check (auth.uid() = requester_id);

drop policy if exists "Participants can update friend requests" on public.friend_requests;
create policy "Participants can update friend requests"
  on public.friend_requests for update
  to authenticated
  using (auth.uid() = requester_id or auth.uid() = recipient_id);

-- ========================================================================
-- Helper: create a friendship in canonical order
-- ========================================================================
create or replace function public.create_friendship(
  p_user_a uuid,
  p_user_b uuid,
  p_origin text default 'friend_request'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  a uuid;
  b uuid;
begin
  if p_user_a = p_user_b then return; end if;
  if p_user_a < p_user_b then a := p_user_a; b := p_user_b;
  else a := p_user_b; b := p_user_a;
  end if;
  insert into public.friendships (user_a, user_b, origin)
  values (a, b, p_origin)
  on conflict (user_a, user_b) do nothing;
end;
$$;

-- ========================================================================
-- Accept a friend request (only the recipient can call this)
-- ========================================================================
create or replace function public.accept_friend_request(request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  v_requester uuid;
  v_recipient uuid;
  v_status public.friend_request_status;
begin
  if me is null then raise exception 'Not authenticated'; end if;

  select requester_id, recipient_id, status
    into v_requester, v_recipient, v_status
    from public.friend_requests
    where id = request_id;

  if not found then raise exception 'Friend request not found'; end if;
  if v_recipient != me then raise exception 'Only the recipient can accept'; end if;
  if v_status != 'pending' then
    raise exception 'Friend request is not pending (current: %)', v_status;
  end if;

  update public.friend_requests
    set status = 'accepted', responded_at = now()
    where id = request_id;

  perform public.create_friendship(v_requester, v_recipient, 'friend_request');

  -- Notify the requester
  insert into public.notifications (user_id, type, title, body, data)
  values (
    v_requester,
    'match',
    'You have a new friend',
    (select full_name from public.profiles where id = v_recipient) || ' accepted your friend request.',
    jsonb_build_object('friend_id', v_recipient, 'request_id', request_id)
  );

  return jsonb_build_object('accepted', true, 'friend_id', v_requester);
end;
$$;

-- ========================================================================
-- Decline a friend request
-- ========================================================================
create or replace function public.decline_friend_request(request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  v_recipient uuid;
  v_status public.friend_request_status;
begin
  if me is null then raise exception 'Not authenticated'; end if;

  select recipient_id, status into v_recipient, v_status
    from public.friend_requests where id = request_id;

  if not found then raise exception 'Friend request not found'; end if;
  if v_recipient != me then raise exception 'Only the recipient can decline'; end if;
  if v_status != 'pending' then
    raise exception 'Friend request is not pending (current: %)', v_status;
  end if;

  update public.friend_requests
    set status = 'declined', responded_at = now()
    where id = request_id;

  return jsonb_build_object('declined', true);
end;
$$;

-- ========================================================================
-- Auto-friend trigger on join_request acceptance
-- Fires whenever a join_request row transitions to status='accepted'.
-- ========================================================================
create or replace function public.on_join_request_accepted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host uuid;
begin
  if new.status = 'accepted' and (old.status is distinct from 'accepted') then
    select host_id into v_host from public.rounds where id = new.round_id;
    if v_host is not null then
      perform public.create_friendship(v_host, new.requester_id, 'round_accept');
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_join_request_auto_friend on public.join_requests;
create trigger trg_join_request_auto_friend
  after update on public.join_requests
  for each row execute function public.on_join_request_accepted();

-- ========================================================================
-- Grants
-- ========================================================================
grant execute on function public.create_friendship(uuid, uuid, text) to authenticated;
grant execute on function public.accept_friend_request(uuid) to authenticated;
grant execute on function public.decline_friend_request(uuid) to authenticated;
