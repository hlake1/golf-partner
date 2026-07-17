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
