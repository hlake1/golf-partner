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
