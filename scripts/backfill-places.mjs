#!/usr/bin/env node
/**
 * Backfill script: Enrich each club in Supabase with Google Places data
 * (google_place_id, rating, rating_count, photo_url).
 *
 * Run once, then re-run monthly to refresh ratings.
 *
 * Usage:
 *   GOOGLE_PLACES_API_KEY=... \
 *   SUPABASE_URL=... \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   node scripts/backfill-places.mjs [--force] [--limit N] [--only "Club Name"]
 *
 * Flags:
 *   --force        Refresh even clubs already enriched.
 *   --limit N      Only process the first N clubs (for testing).
 *   --only "…"     Only process clubs whose name matches this substring (case-insensitive).
 *   --dry-run      Print what would happen without writing to Supabase.
 *
 * Cost estimate: Places API "Text Search" is ~£0.025 per call. Photos are free once
 * you have the reference. For ~50 UK clubs, expect ~£1.25 total.
 */

import { createClient } from '@supabase/supabase-js';

const {
  GOOGLE_PLACES_API_KEY,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
} = process.env;

if (!GOOGLE_PLACES_API_KEY) {
  console.error('❌ Missing GOOGLE_PLACES_API_KEY env var.');
  process.exit(1);
}
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env var.');
  process.exit(1);
}

const args = process.argv.slice(2);
const force = args.includes('--force');
const dryRun = args.includes('--dry-run');
const limitIdx = args.indexOf('--limit');
const limit = limitIdx !== -1 ? Number(args[limitIdx + 1]) : null;
const onlyIdx = args.indexOf('--only');
const onlyFilter = onlyIdx !== -1 ? args[onlyIdx + 1].toLowerCase() : null;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Photo URL builder — we DON'T store Google-hosted photos permanently (their
// terms require you to fetch fresh links). We store the photo_reference and
// build a Places Photo URL on read. But for MVP simplicity we cache the
// resolved URL and refresh monthly. Google is OK with this for up to 30 days
// per their attribution rules.
function buildPhotoUrl(photoReference, maxWidth = 800) {
  return (
    `https://maps.googleapis.com/maps/api/place/photo` +
    `?maxwidth=${maxWidth}` +
    `&photo_reference=${encodeURIComponent(photoReference)}` +
    `&key=${GOOGLE_PLACES_API_KEY}`
  );
}

async function findPlace(name, address) {
  const input = address ? `${name}, ${address}` : name;
  const url =
    `https://maps.googleapis.com/maps/api/place/findplacefromtext/json` +
    `?input=${encodeURIComponent(input)}` +
    `&inputtype=textquery` +
    `&fields=place_id` +
    `&key=${GOOGLE_PLACES_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.status !== 'OK' || !data.candidates?.length) return null;
  return data.candidates[0].place_id;
}

async function fetchDetails(placeId) {
  const url =
    `https://maps.googleapis.com/maps/api/place/details/json` +
    `?place_id=${encodeURIComponent(placeId)}` +
    `&fields=name,rating,user_ratings_total,photos,website` +
    `&key=${GOOGLE_PLACES_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.status !== 'OK' || !data.result) return null;
  return data.result;
}

async function main() {
  console.log(
    `🏌️  Places backfill starting${
      force ? ' (--force)' : ''
    }${dryRun ? ' (--dry-run)' : ''}${
      onlyFilter ? ` (--only "${onlyFilter}")` : ''
    }`
  );

  let query = supabase
    .from('clubs')
    .select('id, name, address, website, google_place_id, rating, photo_url, last_places_lookup_at')
    .order('name');

  if (limit) query = query.limit(limit);

  const { data: clubs, error } = await query;
  if (error) {
    console.error('❌ Failed to load clubs:', error.message);
    process.exit(1);
  }

  console.log(`ℹ️  Loaded ${clubs.length} clubs from Supabase.`);

  let ok = 0;
  let skipped = 0;
  let failed = 0;

  for (const club of clubs) {
    if (onlyFilter && !club.name.toLowerCase().includes(onlyFilter)) continue;

    // "Enriched" now means we have place_id + rating + photo. Discovery
    // fills the first two; backfill's job is mainly to add the photo + website.
    const alreadyEnriched =
      !!club.google_place_id && club.rating !== null && !!club.photo_url;
    if (alreadyEnriched && !force) {
      skipped++;
      continue;
    }

    console.log(`\n→ ${club.name}`);

    try {
      // 1. Find place_id
      let placeId = club.google_place_id;
      if (!placeId) {
        placeId = await findPlace(club.name, club.address);
        if (!placeId) {
          console.log(`  ⚠️  Could not find on Google Places.`);
          failed++;
          continue;
        }
        console.log(`  📍 place_id: ${placeId}`);
      }

      // 2. Fetch details
      const details = await fetchDetails(placeId);
      if (!details) {
        console.log(`  ⚠️  Details lookup failed.`);
        failed++;
        continue;
      }

      const rating = details.rating ?? null;
      const ratingCount = details.user_ratings_total ?? null;
      const photoRef = details.photos?.[0]?.photo_reference ?? null;
      const photoUrl = photoRef ? buildPhotoUrl(photoRef) : null;
      const website = details.website ?? null;

      console.log(
        `  ⭐ ${rating ?? 'no rating'}${
          ratingCount ? ` (${ratingCount} reviews)` : ''
        }${photoUrl ? ' 📷' : ''}`
      );

      if (dryRun) {
        continue;
      }

      const patch = {
        google_place_id: placeId,
        rating,
        rating_count: ratingCount,
        photo_reference: photoRef,
        photo_url: photoUrl,
        photo_updated_at: photoUrl ? new Date().toISOString() : null,
        last_places_lookup_at: new Date().toISOString(),
      };
      // Only overwrite website if the DB doesn't already have one — respects
      // manually-curated URLs from the initial seed.
      if (website && !club.website) {
        patch.website = website;
      }

      const { error: updateErr } = await supabase
        .from('clubs')
        .update(patch)
        .eq('id', club.id);

      if (updateErr) {
        console.log(`  ❌ Supabase update failed: ${updateErr.message}`);
        failed++;
        continue;
      }
      ok++;
    } catch (e) {
      console.log(`  ❌ Exception: ${e.message}`);
      failed++;
    }

    // Gentle rate-limit — Places API allows 100 QPS but there's no rush.
    await new Promise((r) => setTimeout(r, 150));
  }

  console.log(
    `\n✅ Done. Success: ${ok}, Skipped (already enriched): ${skipped}, Failed: ${failed}`
  );
}

main().catch((e) => {
  console.error('❌ Fatal:', e);
  process.exit(1);
});
