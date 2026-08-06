-- ========================================================================
-- 0016: Club Partner Programme (Starter tier)
-- ========================================================================
-- Adds the concept of a "Scramble Partner" club:
--   - Clubs can apply to become partners
--   - An admin reviews + approves the application
--   - Once approved, a designated manager profile can edit the club's
--     partner-facing content (description, photos, course info)
--   - Partners appear on the map with a branded pin + get a rich profile
--
-- Tiers (future-proofed): starter | partner | premium
-- Application status:      pending | approved | rejected

-- ------------------------------------------------------------------------
-- 1. Enums
-- ------------------------------------------------------------------------
do $$ begin
  create type public.partner_tier as enum ('starter', 'partner', 'premium');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.partner_application_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------------------
-- 2. Add partner columns to clubs
-- ------------------------------------------------------------------------
alter table public.clubs
  add column if not exists is_scramble_partner boolean not null default false,
  add column if not exists partner_tier public.partner_tier,
  add column if not exists partner_since timestamptz,
  add column if not exists partner_description text,
  add column if not exists partner_photos text[] not null default '{}',
  add column if not exists partner_hero_photo text,
  add column if not exists partner_holes int check (partner_holes between 1 and 36),
  add column if not exists partner_par int check (partner_par between 30 and 90),
  add column if not exists partner_phone text,
  add column if not exists partner_email text,
  add column if not exists partner_managed_by uuid references public.profiles(id) on delete set null;

create index if not exists clubs_is_partner_idx on public.clubs (is_scramble_partner);
create index if not exists clubs_partner_manager_idx on public.clubs (partner_managed_by);

-- ------------------------------------------------------------------------
-- 3. Club partner applications
-- ------------------------------------------------------------------------
-- A user submits interest in managing a club as a Scramble Partner.
-- Admin (currently manual) reviews + approves/rejects.
create table if not exists public.club_partner_applications (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  applicant_id uuid not null references public.profiles(id) on delete cascade,
  role_at_club text,             -- e.g. "General Manager", "Pro", "Owner"
  message text,                  -- optional pitch from the applicant
  status public.partner_application_status not null default 'pending',
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  review_notes text,
  created_at timestamptz not null default now(),
  unique (club_id, applicant_id, status)  -- one active app per user per club
);

create index if not exists club_apps_club_idx on public.club_partner_applications (club_id);
create index if not exists club_apps_applicant_idx on public.club_partner_applications (applicant_id);
create index if not exists club_apps_status_idx on public.club_partner_applications (status);

-- ------------------------------------------------------------------------
-- 4. App admin flag (super-simple: profiles.is_admin)
-- ------------------------------------------------------------------------
alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- ------------------------------------------------------------------------
-- 5. RLS
-- ------------------------------------------------------------------------
alter table public.club_partner_applications enable row level security;

-- Applicants can see their own applications; admins see everything.
create policy "Applicants read own applications"
  on public.club_partner_applications for select
  to authenticated
  using (
    applicant_id = auth.uid()
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  );

-- Any authenticated user can submit an application for themselves.
create policy "Users can submit applications"
  on public.club_partner_applications for insert
  to authenticated
  with check (applicant_id = auth.uid() and status = 'pending');

-- Only admins can update (approve/reject) applications.
create policy "Admins can update applications"
  on public.club_partner_applications for update
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- Applicants can withdraw (delete) their own pending applications.
create policy "Applicants withdraw pending applications"
  on public.club_partner_applications for delete
  to authenticated
  using (applicant_id = auth.uid() and status = 'pending');

-- ------------------------------------------------------------------------
-- 6. Extend clubs RLS: managers can update their own club's partner fields
-- ------------------------------------------------------------------------
-- Note: base clubs table remains read-only from clients EXCEPT for the
-- assigned partner_managed_by user, who can update partner-facing fields.
-- We use a column-agnostic policy — the CHECK confirms only the manager
-- edits their own club. The client should only send partner-facing fields;
-- we lock down structural columns via a trigger below.

create policy "Club managers can update their own club"
  on public.clubs for update
  to authenticated
  using (partner_managed_by = auth.uid())
  with check (partner_managed_by = auth.uid());

-- Trigger: prevent managers from changing sensitive columns
create or replace function public.enforce_club_manager_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_admin_user boolean;
begin
  select coalesce(is_admin, false) into is_admin_user
    from public.profiles where id = auth.uid();

  if is_admin_user then
    return new;  -- admins can change anything
  end if;

  -- If the caller is (only) the club manager, block changes to structural fields
  if new.id is distinct from old.id
    or new.name is distinct from old.name
    or new.location::text is distinct from old.location::text
    or new.county is distinct from old.county
    or new.country is distinct from old.country
    or new.is_scramble_partner is distinct from old.is_scramble_partner
    or new.partner_tier is distinct from old.partner_tier
    or new.partner_since is distinct from old.partner_since
    or new.partner_managed_by is distinct from old.partner_managed_by
    or new.google_place_id is distinct from old.google_place_id
  then
    raise exception 'Club managers cannot modify structural or admin fields';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_club_manager_scope on public.clubs;
create trigger trg_enforce_club_manager_scope
  before update on public.clubs
  for each row execute function public.enforce_club_manager_scope();

-- ------------------------------------------------------------------------
-- 7. Update nearby_clubs RPC to expose partner fields
-- ------------------------------------------------------------------------
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
  photo_url text,
  is_scramble_partner boolean,
  partner_tier public.partner_tier,
  partner_hero_photo text
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
    c.photo_url,
    c.is_scramble_partner,
    c.partner_tier,
    c.partner_hero_photo
  from public.clubs c, origin o
  where st_dwithin(c.location, o.pt, radius_miles * 1609.344)
  order by
    c.is_scramble_partner desc,  -- partners first
    distance_miles asc
  limit 5000;
$$;

-- ------------------------------------------------------------------------
-- 8. Storage bucket for club photos
-- ------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('club-photos', 'club-photos', true)
on conflict (id) do nothing;

-- Public read (photos are public)
create policy "Public can view club photos"
  on storage.objects for select
  using (bucket_id = 'club-photos');

-- Club managers can upload/update/delete photos in their club's folder
-- Folder convention: club-photos/<club_id>/<filename>
create policy "Club managers can upload club photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'club-photos'
    and exists (
      select 1 from public.clubs c
      where c.id::text = (storage.foldername(name))[1]
        and c.partner_managed_by = auth.uid()
    )
  );

create policy "Club managers can update club photos"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'club-photos'
    and exists (
      select 1 from public.clubs c
      where c.id::text = (storage.foldername(name))[1]
        and c.partner_managed_by = auth.uid()
    )
  );

create policy "Club managers can delete club photos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'club-photos'
    and exists (
      select 1 from public.clubs c
      where c.id::text = (storage.foldername(name))[1]
        and c.partner_managed_by = auth.uid()
    )
  );

-- Admins can do anything with club photos
create policy "Admins manage all club photos"
  on storage.objects for all
  to authenticated
  using (
    bucket_id = 'club-photos'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  )
  with check (
    bucket_id = 'club-photos'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin)
  );

-- ------------------------------------------------------------------------
-- 9. Helper RPC: approve an application (admin only, transactional)
-- ------------------------------------------------------------------------
create or replace function public.approve_partner_application(
  application_id uuid,
  tier public.partner_tier default 'starter'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  app record;
  is_admin_user boolean;
begin
  select coalesce(is_admin, false) into is_admin_user
    from public.profiles where id = auth.uid();
  if not is_admin_user then
    raise exception 'Only admins can approve applications';
  end if;

  select * into app from public.club_partner_applications where id = application_id;
  if not found then
    raise exception 'Application not found';
  end if;
  if app.status <> 'pending' then
    raise exception 'Application is not pending';
  end if;

  -- Mark application approved
  update public.club_partner_applications
    set status = 'approved',
        reviewed_at = now(),
        reviewed_by = auth.uid()
    where id = application_id;

  -- Promote the club
  update public.clubs
    set is_scramble_partner = true,
        partner_tier = tier,
        partner_since = now(),
        partner_managed_by = app.applicant_id
    where id = app.club_id;
end;
$$;

create or replace function public.reject_partner_application(
  application_id uuid,
  reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  is_admin_user boolean;
begin
  select coalesce(is_admin, false) into is_admin_user
    from public.profiles where id = auth.uid();
  if not is_admin_user then
    raise exception 'Only admins can reject applications';
  end if;

  update public.club_partner_applications
    set status = 'rejected',
        reviewed_at = now(),
        reviewed_by = auth.uid(),
        review_notes = reason
    where id = application_id
    and status = 'pending';
end;
$$;
