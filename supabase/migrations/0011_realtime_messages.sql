-- ========================================================================
-- Enable Supabase Realtime on messages and conversations tables.
-- The client subscribes to these to get live message updates.
-- ========================================================================

-- Add tables to the supabase_realtime publication (idempotent via alter/create check)
do $$
begin
  begin
    alter publication supabase_realtime add table public.messages;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.conversations;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.friend_requests;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.friendships;
  exception when duplicate_object then null;
  end;
end $$;

-- Full row replication so we get before/after in updates (needed for realtime)
alter table public.messages replica identity full;
alter table public.conversations replica identity full;
alter table public.friend_requests replica identity full;
alter table public.friendships replica identity full;
