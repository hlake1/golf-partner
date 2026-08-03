-- ========================================================================
-- Helper RPC for scripts to set a club's location without needing raw SQL.
-- Used by scripts/discover-uk-clubs.mjs when inserting new clubs.
-- ========================================================================
create or replace function public.set_club_location(
  club_id uuid,
  lng double precision,
  lat double precision
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.clubs
    set location = st_makepoint(lng, lat)::geography
    where id = club_id;
$$;

-- Also ensure google_place_id is unique so ON CONFLICT works during bulk insert.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'clubs_google_place_id_key'
  ) then
    alter table public.clubs
      add constraint clubs_google_place_id_key unique (google_place_id);
  end if;
end $$;

-- Insert a new club with location in one atomic call. Returns the new row's id.
create or replace function public.insert_club_with_location(
  club_name text,
  club_address text,
  club_country text,
  club_google_place_id text,
  club_rating numeric,
  club_rating_count int,
  club_lng double precision,
  club_lat double precision
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  insert into public.clubs (
    name, address, country, google_place_id, rating, rating_count, location
  )
  values (
    club_name, club_address, club_country, club_google_place_id,
    club_rating, club_rating_count,
    st_makepoint(club_lng, club_lat)::geography
  )
  on conflict (google_place_id) do nothing
  returning id into new_id;
  return new_id;
end;
$$;
