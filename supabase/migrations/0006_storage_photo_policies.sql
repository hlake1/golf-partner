-- ========================================================================
-- RLS policies for profile-photos storage bucket
-- Run this AFTER creating the 'profile-photos' bucket in the Supabase UI.
-- ========================================================================

drop policy if exists "Profile photos are viewable by everyone" on storage.objects;
drop policy if exists "Users can upload their own profile photo" on storage.objects;
drop policy if exists "Users can update their own profile photo" on storage.objects;
drop policy if exists "Users can delete their own profile photo" on storage.objects;

-- Anyone can view profile photos (bucket is public)
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
