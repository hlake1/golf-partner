-- ========================================================================
-- Helper RPC: returns the authenticated user's home_location as lng/lat.
-- Needed because PostgREST can't return PostGIS geography columns as JSON directly.
-- ========================================================================

create or replace function public.my_location()
returns jsonb
language sql
security invoker
stable
as $$
  select jsonb_build_object(
    'lng', st_x(home_location::geometry),
    'lat', st_y(home_location::geometry)
  )
  from public.profiles
  where id = auth.uid()
    and home_location is not null;
$$;
