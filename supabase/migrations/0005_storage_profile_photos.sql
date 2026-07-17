-- ========================================================================
-- Storage bucket for profile photos
-- ========================================================================

-- Create the bucket (public read so photos load in feeds without signed URLs)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-photos',
  'profile-photos',
  true,
  5242880, -- 5MB per file
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ========================================================================
-- RLS on storage.objects for this bucket
-- ========================================================================

-- Drop existing policies with these names if re-running
drop policy if exists "Profile photos are viewable by everyone" on storage.objects;
drop policy if exists "Users can upload their own profile photo" on storage.objects;
drop policy if exists "Users can update their own profile photo" on storage.objects;
drop policy if exists "Users can delete their own profile photo" on storage.objects;

-- Anyone (signed in or not) can view profile photos (bucket is public)
create policy "Profile photos are viewable by everyone"
  on storage.objects for select
  using (bucket_id = 'profile-photos');

-- Users can upload photos into their own folder (path starts with their user id)
create policy "Users can upload their own profile photo"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can overwrite their own photo
create policy "Users can update their own profile photo"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can delete their own photo
create policy "Users can delete their own profile photo"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
