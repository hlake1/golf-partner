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
