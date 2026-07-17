-- ========================================================================
-- Host actions on join requests: accept + decline
-- These wrap: request status update + notification insert + round status refresh
-- into atomic operations so the UI stays consistent.
--
-- Both functions run as SECURITY DEFINER so the notification insert works
-- (bypassing RLS), but they enforce the host-only check explicitly.
-- ========================================================================

create or replace function public.accept_join_request(request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  v_requester uuid;
  v_round_id uuid;
  v_host uuid;
  v_players_needed int;
  v_request_status public.join_request_status;
  v_round_status public.round_status;
  accepted_count int;
  total_spots int;
  final_status public.round_status;
begin
  if me is null then raise exception 'Not authenticated'; end if;

  select jr.requester_id, jr.round_id, jr.status,
         r.host_id, r.players_needed, r.status
    into v_requester, v_round_id, v_request_status,
         v_host, v_players_needed, v_round_status
    from public.join_requests jr
    join public.rounds r on r.id = jr.round_id
    where jr.id = request_id;

  if not found then raise exception 'Request not found'; end if;
  if v_host != me then raise exception 'Only the round host can accept requests'; end if;
  if v_request_status != 'pending' then
    raise exception 'Request is not pending (current: %)', v_request_status;
  end if;

  update public.join_requests
    set status = 'accepted', responded_at = now()
    where id = request_id;

  insert into public.notifications (user_id, type, title, body, data)
  values (
    v_requester,
    'request_accepted',
    'Your join request was accepted',
    'Head to the Calendar tab to see the round details.',
    jsonb_build_object('round_id', v_round_id, 'request_id', request_id)
  );

  select count(*) into accepted_count
    from public.join_requests
    where round_id = v_round_id and status = 'accepted';

  total_spots := 1 + v_players_needed; -- host + spots

  if accepted_count >= v_players_needed then
    update public.rounds set status = 'full' where id = v_round_id;
    final_status := 'full';
  else
    final_status := v_round_status;
  end if;

  return jsonb_build_object(
    'accepted', true,
    'round_status', final_status,
    'accepted_count', accepted_count,
    'total_spots', total_spots
  );
end;
$$;

create or replace function public.decline_join_request(request_id uuid, decline_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  v_requester uuid;
  v_round_id uuid;
  v_host uuid;
  v_request_status public.join_request_status;
begin
  if me is null then raise exception 'Not authenticated'; end if;

  select jr.requester_id, jr.round_id, jr.status, r.host_id
    into v_requester, v_round_id, v_request_status, v_host
    from public.join_requests jr
    join public.rounds r on r.id = jr.round_id
    where jr.id = request_id;

  if not found then raise exception 'Request not found'; end if;
  if v_host != me then raise exception 'Only the round host can decline requests'; end if;
  if v_request_status != 'pending' then
    raise exception 'Request is not pending (current: %)', v_request_status;
  end if;

  update public.join_requests
    set status = 'declined', responded_at = now()
    where id = request_id;

  insert into public.notifications (user_id, type, title, body, data)
  values (
    v_requester,
    'request_declined',
    'Your join request was declined',
    coalesce(decline_reason, 'The host declined your request. Check the Calendar tab for other open rounds.'),
    jsonb_build_object('round_id', v_round_id, 'request_id', request_id)
  );

  return jsonb_build_object('declined', true);
end;
$$;

grant execute on function public.accept_join_request(uuid) to authenticated;
grant execute on function public.decline_join_request(uuid, text) to authenticated;
