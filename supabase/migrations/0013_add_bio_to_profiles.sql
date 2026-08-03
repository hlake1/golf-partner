-- ========================================================================
-- Add `bio` (short about-me / interests) to profiles
-- ========================================================================
-- A short free-text field where players can describe themselves, their
-- interests, or what they're looking for on the course. Optional and
-- capped at a reasonable length so it doesn't turn into an essay.

alter table public.profiles
  add column if not exists bio text
    check (bio is null or char_length(bio) <= 500);

-- Expose it on the discovery RPC so nearby players can show a preview.
-- Return-type change requires dropping the old signature first.
drop function if exists public.nearby_players(
  double precision, double precision, double precision, uuid
);

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
  bio text,
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
    p.bio,
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
