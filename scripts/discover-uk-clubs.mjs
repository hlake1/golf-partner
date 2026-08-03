#!/usr/bin/env node
/**
 * Discover every UK golf course via Google Places API and upsert into Supabase.
 *
 * Strategy:
 *   Google Places "Text Search" caps at 60 results per query (20 per page × 3).
 *   To get full UK coverage we run one search per postcode-area / region so we
 *   hit lots of small, non-overlapping result sets. We then dedupe by place_id.
 *
 * The `SEARCH_REGIONS` list below covers all 121 UK postcode areas plus a few
 * geographic fillers. Empirically this returns ~2,000-3,000 unique golf clubs
 * (there are ~2,600 in the UK).
 *
 * Cost estimate:
 *   ~130 text-search queries × ~£0.025 per call = ~£3.30 for discovery.
 *   Then backfill-places.mjs enriches each new club with details + photo:
 *     ~2,600 clubs × ~£0.02 = ~£52.
 *   Total: ~£55 one-off. Refreshes monthly are much cheaper (just details).
 *
 * Usage:
 *   GOOGLE_PLACES_API_KEY=... \
 *   SUPABASE_URL=... \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   node scripts/discover-uk-clubs.mjs [--dry-run] [--only "OX"] [--concurrency N]
 *
 * Flags:
 *   --dry-run         Print what would be inserted, no writes.
 *   --only "AREA"     Only search this postcode area (e.g. "OX", "London").
 *   --concurrency N   Parallel search queries (default 4, max 8).
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
const dryRun = args.includes('--dry-run');
const onlyIdx = args.indexOf('--only');
const onlyFilter = onlyIdx !== -1 ? args[onlyIdx + 1].toUpperCase() : null;
const concIdx = args.indexOf('--concurrency');
const concurrency = Math.max(
  1,
  Math.min(8, concIdx !== -1 ? Number(args[concIdx + 1]) : 4)
);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// UK postcode areas + a few geographic supplements. Each row = one query.
// Full list of 121 UK postcode areas from Wikipedia (Royal Mail).
const SEARCH_REGIONS = [
  // England
  'AL', 'B', 'BA', 'BB', 'BD', 'BH', 'BL', 'BN', 'BR', 'BS',
  'CA', 'CB', 'CH', 'CM', 'CO', 'CR', 'CT', 'CV', 'CW',
  'DA', 'DE', 'DH', 'DL', 'DN', 'DT', 'DY',
  'E', 'EC', 'EN', 'EX',
  'FY',
  'GL', 'GU',
  'HA', 'HD', 'HG', 'HP', 'HR', 'HU', 'HX',
  'IG', 'IP',
  'KT',
  'L', 'LA', 'LE', 'LN', 'LS', 'LU',
  'M', 'ME', 'MK',
  'N', 'NE', 'NG', 'NN', 'NR', 'NW',
  'OL', 'OX',
  'PE', 'PL', 'PO', 'PR',
  'RG', 'RH', 'RM',
  'S', 'SE', 'SG', 'SK', 'SL', 'SM', 'SN', 'SO', 'SP', 'SR', 'SS', 'ST', 'SW',
  'TA', 'TF', 'TN', 'TQ', 'TR', 'TS', 'TW',
  'UB',
  'W', 'WA', 'WC', 'WD', 'WF', 'WN', 'WR', 'WS', 'WV',
  'YO',
  // Wales
  'CF', 'LD', 'LL', 'NP', 'SA', 'SY',
  // Scotland
  'AB', 'DD', 'DG', 'EH', 'FK', 'G', 'HS', 'IV', 'KA', 'KW', 'KY',
  'ML', 'PA', 'PH', 'TD', 'ZE',
  // Northern Ireland
  'BT',
  // Channel Islands & Isle of Man
  'GY', 'IM', 'JE',
];

async function textSearch(query, pageToken = null) {
  const url = pageToken
    ? `https://maps.googleapis.com/maps/api/place/textsearch/json?pagetoken=${encodeURIComponent(
        pageToken
      )}&key=${GOOGLE_PLACES_API_KEY}`
    : `https://maps.googleapis.com/maps/api/place/textsearch/json` +
      `?query=${encodeURIComponent(query)}` +
      `&type=golf_course` +
      `&region=uk` +
      `&key=${GOOGLE_PLACES_API_KEY}`;

  const res = await fetch(url);
  const data = await res.json();
  if (data.status === 'ZERO_RESULTS') return { results: [], nextPageToken: null };
  // On paginated calls, INVALID_REQUEST usually means "token not ready yet."
  // Retry once with a longer sleep before giving up.
  if (pageToken && data.status === 'INVALID_REQUEST') {
    await new Promise((r) => setTimeout(r, 3000));
    const retryRes = await fetch(url);
    const retryData = await retryRes.json();
    if (retryData.status === 'OK') {
      return {
        results: retryData.results ?? [],
        nextPageToken: retryData.next_page_token ?? null,
      };
    }
    // Give up on this page but don't throw — page 1 results are still good.
    return { results: [], nextPageToken: null };
  }
  if (data.status !== 'OK') {
    throw new Error(`Places API status=${data.status} error=${data.error_message ?? ''}`);
  }
  return {
    results: data.results ?? [],
    nextPageToken: data.next_page_token ?? null,
  };
}

async function searchRegion(area) {
  const query = `golf course in ${area}, UK`;
  const all = [];
  let pageToken = null;
  let page = 0;
  do {
    // Google requires a delay before next_page_token becomes valid — 3s is
    // usually enough. textSearch() retries once with an additional 3s if it
    // still fails.
    if (pageToken) await new Promise((r) => setTimeout(r, 3000));
    try {
      const { results, nextPageToken } = await textSearch(query, pageToken);
      all.push(...results);
      pageToken = nextPageToken;
    } catch (e) {
      // Only page 1 failures reach here (paginated failures return empty).
      // Log and stop paging for this region.
      console.log(`    ⚠️  ${area} page ${page + 1}: ${e.message}`);
      pageToken = null;
    }
    page++;
  } while (pageToken && page < 3);
  return { area, results: all };
}

function normaliseName(name) {
  return name.trim().replace(/\s+/g, ' ');
}

function looksLikeGolfClub(place) {
  const types = place.types ?? [];
  if (types.includes('golf_course')) return true;
  const name = (place.name ?? '').toLowerCase();
  // Filter out golf shops, driving ranges masquerading as courses, etc.
  if (name.includes('golf shop')) return false;
  if (name.includes('mini golf')) return false;
  if (name.includes('crazy golf')) return false;
  if (name.includes('adventure golf')) return false;
  return name.includes('golf');
}

async function main() {
  const regions = onlyFilter
    ? SEARCH_REGIONS.filter((r) => r === onlyFilter)
    : SEARCH_REGIONS;

  if (regions.length === 0) {
    console.error(`❌ No matching region for --only "${onlyFilter}"`);
    process.exit(1);
  }

  console.log(
    `🌍 Discovering UK golf courses across ${regions.length} region(s)` +
      ` at concurrency=${concurrency}${dryRun ? ' (--dry-run)' : ''}`
  );

  // Run searches in parallel batches.
  const byPlaceId = new Map();
  for (let i = 0; i < regions.length; i += concurrency) {
    const batch = regions.slice(i, i + concurrency);
    const settled = await Promise.allSettled(batch.map(searchRegion));
    for (const s of settled) {
      if (s.status === 'rejected') {
        console.log(`  ❌ Search failed: ${s.reason?.message ?? s.reason}`);
        continue;
      }
      const { area, results } = s.value;
      const clubs = results.filter(looksLikeGolfClub);
      console.log(
        `  📍 ${area}: ${clubs.length} club(s) (${results.length} raw)`
      );
      for (const p of clubs) {
        if (!p.place_id) continue;
        if (!byPlaceId.has(p.place_id)) {
          byPlaceId.set(p.place_id, p);
        }
      }
    }
  }

  console.log(`\n📊 Unique clubs discovered: ${byPlaceId.size}`);

  // Load existing clubs to avoid duplicates by place_id (and match on name for
  // legacy seeds that don't have a place_id yet).
  const { data: existing, error: existingErr } = await supabase
    .from('clubs')
    .select('id, name, google_place_id');
  if (existingErr) {
    console.error('❌ Failed to load existing clubs:', existingErr.message);
    process.exit(1);
  }
  const existingByPlaceId = new Map(
    existing.filter((c) => c.google_place_id).map((c) => [c.google_place_id, c])
  );
  const existingByName = new Map(
    existing.map((c) => [normaliseName(c.name).toLowerCase(), c])
  );

  // Determine country (best-effort from address).
  function countryFromAddress(addr) {
    if (!addr) return 'UK';
    if (/scotland|,\s*scotland/i.test(addr)) return 'Scotland';
    if (/wales|,\s*wales/i.test(addr)) return 'Wales';
    if (/northern ireland|,\s*northern ireland/i.test(addr)) return 'Northern Ireland';
    return 'England'; // default for UK-region search
  }

  let toInsert = [];
  let toLinkPlaceId = [];
  let skipped = 0;

  for (const p of byPlaceId.values()) {
    const name = normaliseName(p.name ?? '');
    const address = p.formatted_address ?? null;
    const lat = p.geometry?.location?.lat;
    const lng = p.geometry?.location?.lng;
    if (!name || lat == null || lng == null) {
      skipped++;
      continue;
    }

    if (existingByPlaceId.has(p.place_id)) {
      skipped++; // already fully linked
      continue;
    }
    const legacyMatch = existingByName.get(name.toLowerCase());
    if (legacyMatch) {
      toLinkPlaceId.push({ id: legacyMatch.id, place_id: p.place_id });
      continue;
    }

    toInsert.push({
      name,
      address,
      website: null, // filled in later by backfill (details lookup)
      country: countryFromAddress(address),
      google_place_id: p.place_id,
      rating: p.rating ?? null,
      rating_count: p.user_ratings_total ?? null,
      // NOTE: we store lat/lng in the geography column via RPC — do it below
      _lat: lat,
      _lng: lng,
    });
  }

  console.log(
    `\n📋 Plan: insert ${toInsert.length} new, link ${toLinkPlaceId.length} existing, skip ${skipped}`
  );

  if (dryRun) {
    console.log('\n(dry-run — no writes)');
    console.log('First 10 new clubs:');
    toInsert.slice(0, 10).forEach((c) => {
      console.log(`  • ${c.name}${c.rating ? ` ⭐ ${c.rating}` : ''} — ${c.address}`);
    });
    return;
  }

  // Insert new clubs one at a time via a plpgsql RPC that sets location
  // atomically. Small perf hit vs. bulk insert, but safe and correct.
  let inserted = 0;
  for (const c of toInsert) {
    const { error } = await supabase.rpc('insert_club_with_location', {
      club_name: c.name,
      club_address: c.address,
      club_country: c.country,
      club_google_place_id: c.google_place_id,
      club_rating: c.rating,
      club_rating_count: c.rating_count,
      club_lng: c._lng,
      club_lat: c._lat,
    });
    if (error) {
      console.log(`  ❌ Insert ${c.name}: ${error.message}`);
      continue;
    }
    inserted++;
  }

  // Link legacy clubs (those we seeded manually) to their place_id so the
  // backfill script can enrich them next.
  let linked = 0;
  for (const l of toLinkPlaceId) {
    const { error } = await supabase
      .from('clubs')
      .update({ google_place_id: l.place_id })
      .eq('id', l.id);
    if (error) {
      console.log(`  ❌ Link ${l.id}: ${error.message}`);
    } else {
      linked++;
    }
  }

  console.log(
    `\n✅ Done. Inserted: ${inserted}, Linked: ${linked}, Skipped: ${skipped}`
  );
  console.log(
    `\n👉 Next: run \`node scripts/backfill-places.mjs\` to fill in photos + website + refresh ratings.`
  );
}

main().catch((e) => {
  console.error('❌ Fatal:', e);
  process.exit(1);
});
