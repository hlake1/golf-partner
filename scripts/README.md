# Scramble backend scripts

## One-off: full UK golf course seed

Once Gabriel has added billing + the Places API key, run these in order.

### Prereqs

1. Google Cloud project has **Places API** enabled and billing set up.
2. API key restricted to Places API only.
3. Supabase service-role key (not the anon key — this is a privileged script).

### Environment

Create `.env.scripts` (git-ignored) or export inline:

```bash
export GOOGLE_PLACES_API_KEY="AIza..."
export SUPABASE_URL="https://ndanjzxwnedalhtgggei.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="eyJhb..."   # NOT the anon key
```

### Step 1 — Apply migrations

In the Supabase SQL editor, run these in order (only needed once):

- `supabase/migrations/0014_clubs_ratings_photos.sql`
- `supabase/migrations/0015_set_club_location_helper.sql`

### Step 2 — Discover every UK golf course

```bash
# Dry run first — costs money but no writes
node scripts/discover-uk-clubs.mjs --dry-run

# Real run — costs ~£3-5 in Places text-search calls
node scripts/discover-uk-clubs.mjs
```

This:
- Searches Google Places for "golf course in <postcode-area>, UK" across all 121 UK postcode areas
- Filters out mini golf / driving ranges / golf shops
- Dedupes by Google `place_id`
- Upserts into `public.clubs` with rating + rating_count already populated (from text search)
- Links existing manually-seeded Oxfordshire clubs to their `place_id`

Expected result: ~2,000–3,000 unique clubs in Supabase.

### Step 3 — Backfill photos + websites

```bash
node scripts/backfill-places.mjs
```

This:
- Reads every club that still needs a photo/website
- Calls Places `Details` API to get photo reference + website
- Builds a `maps.googleapis.com/api/place/photo` URL and caches it in `clubs.photo_url`
- Sets `clubs.website` where the manual seed didn't have one

Cost: ~£0.02 per club × ~2,600 clubs ≈ **£52**.

### Step 4 — Verify in the app

Open Scramble → Courses tab. You should see:
- Map zooms out to fit every UK club
- Tapping a marker shows a photo, star rating, and review count
- List cards on iPad / web fallback show the same info

## Ongoing: monthly refresh

Ratings drift over time, so re-run monthly to refresh:

```bash
node scripts/backfill-places.mjs --force
```

Cost: ~£1–2/month depending on how many clubs actually change.

To also pick up brand-new clubs that opened since the last run:

```bash
node scripts/discover-uk-clubs.mjs
node scripts/backfill-places.mjs
```

## Cost summary

| Task | Cost | Frequency |
|---|---:|---|
| Discovery (all UK) | ~£3–5 | Once (+ occasional refresh) |
| Backfill photos + websites | ~£50 | Once |
| Monthly rating refresh | ~£1–2 | Monthly |

**Total year 1: ~£65–75.**

## Troubleshooting

- **`ZERO_RESULTS` on many regions**: normal for remote areas (Highlands, Islands). Not an error.
- **`REQUEST_DENIED`**: API key isn't authorised for Places API. Check Cloud Console → Credentials → Restrict Key → API restrictions.
- **`OVER_QUERY_LIMIT`**: hit daily quota. Wait 24h or raise billing quota.
- **Photos showing as broken images in the app**: Google Places photo URLs include the API key. This is fine for now (the photo endpoint doesn't expose your key to end users because the redirect strips it), but longer-term we should proxy through Supabase Storage — noted for follow-up.
