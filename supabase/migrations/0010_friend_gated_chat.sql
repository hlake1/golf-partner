-- ========================================================================
-- Gate chat on friendship: users can only start/participate in conversations
-- with people they're friends with. Everything else stays the same.
--
-- Also: helper to check "are these two users friends?"
-- ========================================================================

create or replace function public.are_friends(u1 uuid, u2 uuid)
returns boolean
language sql
stable
security invoker
as $$
  select exists (
    select 1 from public.friendships
    where (user_a = least(u1, u2) and user_b = greatest(u1, u2))
  );
$$;

grant execute on function public.are_friends(uuid, uuid) to authenticated;

-- Replace conversations INSERT policy to require friendship
drop policy if exists "Users can create conversations they participate in" on public.conversations;

create policy "Users can create conversations with friends"
  on public.conversations for insert
  to authenticated
  with check (
    (auth.uid() = user_a or auth.uid() = user_b)
    and public.are_friends(user_a, user_b)
  );

-- Replace messages INSERT policy to require friendship too
drop policy if exists "Participants can send messages" on public.messages;

create policy "Friends can send messages"
  on public.messages for insert
  to authenticated
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (auth.uid() = c.user_a or auth.uid() = c.user_b)
        and public.are_friends(c.user_a, c.user_b)
    )
  );

-- The existing SELECT + UPDATE policies on messages/conversations stay as-is:
-- participants can still read old messages even if they unfriend later.
