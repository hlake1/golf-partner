import { supabase } from './supabase';

/**
 * Uploads a local image URI (from expo-image-picker) to the profile-photos
 * bucket and returns the public URL.
 *
 * Path shape: <user_id>/profile.<ext> — so RLS policy `storage.foldername = auth.uid()`
 * lets the user overwrite their own photo but not anyone else's.
 */
export async function uploadProfilePhoto(
  localUri: string,
  userId: string
): Promise<string> {
  // Derive extension + content type from URI
  const uriParts = localUri.split('.');
  const rawExt = (uriParts[uriParts.length - 1] || 'jpg').toLowerCase().split('?')[0];
  const ext = ['jpeg', 'jpg', 'png', 'webp'].includes(rawExt) ? rawExt : 'jpg';
  const contentType =
    ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

  // Read the local file as an ArrayBuffer (React Native / Expo fetch supports this)
  const response = await fetch(localUri);
  const arrayBuffer = await response.arrayBuffer();

  // Path: <user_id>/profile.<ext>
  const path = `${userId}/profile.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from('profile-photos')
    .upload(path, arrayBuffer, {
      contentType,
      upsert: true, // overwrite existing photo
    });

  if (uploadErr) {
    throw new Error(`Photo upload failed: ${uploadErr.message}`);
  }

  // Get the public URL (bucket is public so no signed URL needed)
  const { data } = supabase.storage.from('profile-photos').getPublicUrl(path);
  // Append a cache-buster so the UI refetches after re-upload
  return `${data.publicUrl}?t=${Date.now()}`;
}
