-- ========================================================================
-- Add Google Places metadata to clubs (rating, photo, place id)
-- ========================================================================
-- We look up each club against the Google Places API once, cache the result
-- in this table, then refresh periodically (e.g. monthly). This keeps the
-- app snappy and the Places bill small.

alter table public.clubs
  add column if not exists google_place_id text,
  add column if not exists rating numeric(3, 2),
  add column if not exists rating_count int,
  add column if not exists photo_reference text,
  add column if not exists photo_url text,
  add column if not exists photo_updated_at timestamptz,
  add column if not exists last_places_lookup_at timestamptz;

create index if not exists clubs_place_id_idx on public.clubs (google_place_id);

-- Update the nearby_clubs RPC to expose the new fields.
drop function if exists public.nearby_clubs(
  double precision, double precision, double precision
);

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
  distance_miles double precision,
  rating numeric,
  rating_count int,
  photo_url text
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
    (st_distance(c.location, o.pt) / 1609.344)::double precision as distance_miles,
    c.rating,
    c.rating_count,
    c.photo_url
  from public.clubs c, origin o
  where st_dwithin(c.location, o.pt, radius_miles * 1609.344)
  order by distance_miles asc
  limit 5000;
$$;
