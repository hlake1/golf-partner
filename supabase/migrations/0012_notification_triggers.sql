-- ========================================================================
-- Notification triggers + enum fix
--
-- 1. Add missing values to notification_type enum:
--      - 'friend_request'   (recipient gets notified when someone friend-requests them)
--      - 'friend_accepted'  (requester gets notified when the other side accepts)
--    (Replaces the buggy use of 'match' in 0009_friends.sql which was not in the enum.)
--
-- 2. Patch public.accept_friend_request to use 'friend_accepted' instead of 'match'.
--
-- 3. New triggers:
--      - on_join_request_created  -> notify host
--      - on_friend_request_created -> notify recipient
--      - on_new_message           -> notify the other participant in the conversation
--
-- 4. Enable realtime on public.notifications so the app can subscribe to inserts.
-- ========================================================================

-- ------------------------------------------------------------------------
-- 1. Extend notification_type enum
-- ------------------------------------------------------------------------
do $$ begin
  alter type public.notification_type add value if not exists 'friend_request';
exception when others then null; end $$;

do $$ begin
  alter type public.notification_type add value if not exists 'friend_accepted';
exception when others then null; end $$;

-- ------------------------------------------------------------------------
-- 2. Patch accept_friend_request to use the correct enum value
-- ------------------------------------------------------------------------
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

  -- Notify the requester (was 'match' before, which broke the enum)
  insert into public.notifications (user_id, type, title, body, data)
  values (
    v_requester,
    'friend_accepted',
    'You have a new friend',
    (select full_name from public.profiles where id = v_recipient) || ' accepted your friend request.',
    jsonb_build_object('friend_id', v_recipient, 'request_id', request_id)
  );

  return jsonb_build_object('accepted', true, 'friend_id', v_requester);
end;
$$;

-- ------------------------------------------------------------------------
-- 3a. Trigger: notify host on new join_request
-- ------------------------------------------------------------------------
create or replace function public.notify_host_on_join_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host uuid;
  v_requester_name text;
  v_club_name text;
begin
  select r.host_id, c.name
    into v_host, v_club_name
    from public.rounds r
    join public.clubs c on c.id = r.club_id
    where r.id = new.round_id;

  if v_host is null then return new; end if;
  if v_host = new.requester_id then return new; end if; -- shouldn't happen, but safe

  select full_name into v_requester_name
    from public.profiles where id = new.requester_id;

  insert into public.notifications (user_id, type, title, body, data)
  values (
    v_host,
    'join_request',
    coalesce(v_requester_name, 'Someone') || ' wants to join your round',
    'Tap to review the request'
      || case when v_club_name is not null then ' at ' || v_club_name else '' end || '.',
    jsonb_build_object(
      'round_id', new.round_id,
      'request_id', new.id,
      'requester_id', new.requester_id
    )
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_host_on_join_request on public.join_requests;
create trigger trg_notify_host_on_join_request
  after insert on public.join_requests
  for each row execute function public.notify_host_on_join_request();

-- ------------------------------------------------------------------------
-- 3b. Trigger: notify recipient on new friend_request
-- ------------------------------------------------------------------------
create or replace function public.notify_on_friend_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_requester_name text;
begin
  if new.status != 'pending' then return new; end if;

  select full_name into v_requester_name
    from public.profiles where id = new.requester_id;

  insert into public.notifications (user_id, type, title, body, data)
  values (
    new.recipient_id,
    'friend_request',
    'New friend request',
    coalesce(v_requester_name, 'Someone') || ' wants to be your friend.',
    jsonb_build_object(
      'request_id', new.id,
      'requester_id', new.requester_id
    )
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_on_friend_request on public.friend_requests;
create trigger trg_notify_on_friend_request
  after insert on public.friend_requests
  for each row execute function public.notify_on_friend_request();

-- ------------------------------------------------------------------------
-- 3c. Trigger: notify other participant on new message
-- ------------------------------------------------------------------------
create or replace function public.notify_on_new_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_a uuid;
  v_user_b uuid;
  v_recipient uuid;
  v_sender_name text;
  v_preview text;
begin
  select user_a, user_b into v_user_a, v_user_b
    from public.conversations where id = new.conversation_id;

  if v_user_a is null then return new; end if;

  v_recipient := case
    when new.sender_id = v_user_a then v_user_b
    when new.sender_id = v_user_b then v_user_a
    else null
  end;

  if v_recipient is null then return new; end if;

  select full_name into v_sender_name
    from public.profiles where id = new.sender_id;

  -- Trim preview to 80 chars for the notification body
  v_preview := case
    when length(new.content) > 80 then substring(new.content from 1 for 77) || '...'
    else new.content
  end;

  insert into public.notifications (user_id, type, title, body, data)
  values (
    v_recipient,
    'new_message',
    coalesce(v_sender_name, 'New message'),
    v_preview,
    jsonb_build_object(
      'conversation_id', new.conversation_id,
      'message_id', new.id,
      'sender_id', new.sender_id
    )
  );

  return new;
end;
$$;

drop trigger if exists trg_notify_on_new_message on public.messages;
create trigger trg_notify_on_new_message
  after insert on public.messages
  for each row execute function public.notify_on_new_message();

-- ------------------------------------------------------------------------
-- 4. Enable realtime on notifications
-- ------------------------------------------------------------------------
do $$
begin
  begin
    alter publication supabase_realtime add table public.notifications;
  exception when duplicate_object then null;
  end;
end $$;

alter table public.notifications replica identity full;
