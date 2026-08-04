import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  Linking,
  Image,
  TextInput,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import MapView, { Marker, Region, PROVIDER_DEFAULT } from 'react-native-maps';
import { colors } from '../theme/colors';
import { useProfile } from '../hooks/useProfile';
import { useNearbyClubs, NearbyClub } from '../hooks/useNearbyClubs';

// Simple radius options that match the rest of the app (Home screen uses similar).
// 'all' fetches every club by using a very large radius (covers the whole planet).
const RADIUS_OPTIONS: Array<{ label: string; miles: number; isAll?: boolean }> = [
  { label: '5 mi', miles: 5 },
  { label: '10 mi', miles: 10 },
  { label: '25 mi', miles: 25 },
  { label: '50 mi', miles: 50 },
  { label: 'All', miles: 25000, isAll: true },
];

// Rough conversion: 1 latitude degree ≈ 69 miles. Longitude scales by cos(lat).
function regionForRadius(
  center: { latitude: number; longitude: number },
  radiusMiles: number
): Region {
  const latDelta = (radiusMiles * 2.4) / 69; // pad ~20% around the circle
  const lngDelta =
    latDelta / Math.max(0.2, Math.cos((center.latitude * Math.PI) / 180));
  return {
    latitude: center.latitude,
    longitude: center.longitude,
    latitudeDelta: latDelta,
    longitudeDelta: lngDelta,
  };
}

export default function MapScreen() {
  const { profile } = useProfile();
  const navigation = useNavigation<any>();

  // Jump to the Calendar tab and pre-open the Create Round flow with this club.
  const postRoundHere = (clubId: string) => {
    navigation.navigate('Calendar', { postRound: { clubId } });
  };
  const [radius, setRadius] = useState<number>(profile?.search_radius_miles ?? 25);
  const [liveOrigin, setLiveOrigin] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [locStatus, setLocStatus] = useState<'idle' | 'asking' | 'granted' | 'denied'>(
    'idle'
  );
  const [selected, setSelected] = useState<NearbyClub | null>(null);
  // Default to a sensible local radius (25 mi) rather than "All" — most
  // users aren't going to travel the country for a round. They can still
  // tap "All" to see every club we have.
  const [showAll, setShowAll] = useState(false);
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const mapRef = useRef<MapView>(null);

  // Keep radius in sync with profile's default (only until user picks manually).
  const [userPickedRadius, setUserPickedRadius] = useState(false);
  useEffect(() => {
    if (!userPickedRadius && profile?.search_radius_miles) {
      setRadius(profile.search_radius_miles);
    }
  }, [profile?.search_radius_miles, userPickedRadius]);

  // Ask for foreground location once on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLocStatus('asking');
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        if (status !== 'granted') {
          setLocStatus('denied');
          return;
        }
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (cancelled) return;
        setLiveOrigin({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
        setLocStatus('granted');
      } catch {
        if (!cancelled) setLocStatus('denied');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // When "All" is selected we fetch with a huge radius (whole planet).
  const effectiveRadiusMiles = showAll ? 25000 : radius;

  const { clubs, loading, error, usedOrigin, refresh } = useNearbyClubs({
    radiusMiles: effectiveRadiusMiles,
    origin: liveOrigin,
  });

  // Framing radius for the map view (not the query). For "All" we'd want to
  // fit-to-markers, so leave initial framing as the last chosen local radius.
  const framingRadius = showAll ? radius : radius;

  const initialRegion = useMemo<Region | null>(() => {
    if (!usedOrigin) return null;
    return regionForRadius(usedOrigin, framingRadius);
  }, [usedOrigin, framingRadius]);

  // Re-frame the map when radius changes (not on every origin tick).
  // - Normal radius: zoom to fit that radius around origin.
  // - "All": fit to all markers so the user sees the full spread.
  useEffect(() => {
    if (!mapRef.current) return;
    if (showAll && clubs.length > 0) {
      mapRef.current.fitToCoordinates(
        clubs.map((c) => ({ latitude: c.latitude, longitude: c.longitude })),
        {
          edgePadding: { top: 80, right: 40, bottom: 160, left: 40 },
          animated: true,
        }
      );
      return;
    }
    if (usedOrigin) {
      mapRef.current.animateToRegion(regionForRadius(usedOrigin, radius), 500);
    }
    // Intentionally NOT depending on usedOrigin here so scrolling the map
    // doesn't yank you back. Recentre button is the explicit way to return.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radius, showAll, clubs.length]);

  // Recentre: animate back to the user's origin at their chosen radius.
  const recentre = () => {
    if (!mapRef.current || !usedOrigin) return;
    mapRef.current.animateToRegion(regionForRadius(usedOrigin, radius), 500);
  };

  const openWebsite = (url: string) => {
    const withScheme = url.startsWith('http') ? url : `https://${url}`;
    Linking.openURL(withScheme).catch(() => {});
  };

  // Search results: filter loaded clubs by name/address (top 8 matches).
  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return clubs
      .filter((c) => {
        if (c.name.toLowerCase().includes(q)) return true;
        if (c.address && c.address.toLowerCase().includes(q)) return true;
        return false;
      })
      .slice(0, 8);
  }, [clubs, search]);

  // Zoom the map to a specific club when the user picks it from search.
  const focusOnClub = (club: NearbyClub) => {
    setSelected(club);
    setSearch('');
    setSearchFocused(false);
    Keyboard.dismiss();
    if (mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: club.latitude,
          longitude: club.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        },
        500
      );
    }
  };

  // Web fallback: react-native-maps doesn't support web without extra setup.
  if (Platform.OS === 'web') {
    return (
      <SafeAreaView style={styles.container} edges={['left', 'right']}>
        <ScrollView contentContainerStyle={styles.webWrap}>
          <Text style={styles.webEmoji}>🗺️</Text>
          <Text style={styles.webTitle}>Course map is mobile-only</Text>
          <Text style={styles.webSubtitle}>
            The interactive map runs on iOS and Android. Here's the list of nearby
            courses in the meantime.
          </Text>
          {loading ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
          ) : (
            <View style={styles.list}>
              {clubs.map((c) => (
                <ClubCard
                  key={c.id}
                  club={c}
                  onOpenWebsite={openWebsite}
                  onPostRound={postRoundHere}
                />
              ))}
              {clubs.length === 0 && !error && (
                <Text style={styles.emptyText}>
                  No courses within {radius} miles.
                </Text>
              )}
              {error && <Text style={styles.errorText}>{error}</Text>}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      {/* Search bar */}
      <View style={styles.mapSearchRow}>
        <View style={[styles.mapSearchWrap, { flex: 1 }]}>
          <Text style={styles.mapSearchIcon}>🔍</Text>
          <TextInput
            style={styles.mapSearchInput}
            placeholder={`Search ${clubs.length} clubs…`}
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
            onFocus={() => setSearchFocused(true)}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {search.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setSearch('');
                Keyboard.dismiss();
              }}
              hitSlop={8}
            >
              <Text style={styles.mapSearchClear}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
        {searchFocused && (
          <TouchableOpacity
            style={styles.mapSearchCancel}
            onPress={() => {
              setSearch('');
              setSearchFocused(false);
              Keyboard.dismiss();
            }}
            hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
          >
            <Text style={styles.mapSearchCancelText}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Search results dropdown */}
      {searchFocused && searchResults.length > 0 && (
        <View style={styles.searchResultsWrap}>
          <ScrollView keyboardShouldPersistTaps="handled">
            {searchResults.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={styles.searchResultRow}
                onPress={() => focusOnClub(c)}
                activeOpacity={0.6}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.searchResultName} numberOfLines={1}>
                    {c.name}
                  </Text>
                  {c.address && (
                    <Text style={styles.searchResultAddress} numberOfLines={1}>
                      {c.address}
                    </Text>
                  )}
                </View>
                {c.rating !== null && (
                  <View style={styles.searchResultRating}>
                    <Text style={styles.searchResultStar}>★</Text>
                    <Text style={styles.searchResultRatingValue}>
                      {c.rating.toFixed(1)}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {searchFocused && search.length > 0 && searchResults.length === 0 && (
        <View style={styles.searchResultsWrap}>
          <Text style={styles.searchEmpty}>
            No clubs match “{search}”.
          </Text>
        </View>
      )}

      {/* Radius picker */}
      <View style={styles.radiusBar}>
        <Text style={styles.radiusLabel}>Radius</Text>
        <View style={styles.radiusPills}>
          {RADIUS_OPTIONS.map((opt) => {
            const active = opt.isAll ? showAll : !showAll && opt.miles === radius;
            return (
              <TouchableOpacity
                key={opt.label}
                style={[styles.pill, active && styles.pillActive]}
                onPress={() => {
                  if (opt.isAll) {
                    setShowAll(true);
                    setSelected(null);
                  } else {
                    setShowAll(false);
                    setRadius(opt.miles);
                    setUserPickedRadius(true);
                  }
                }}
              >
                <Text style={[styles.pillText, active && styles.pillTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Map */}
      <View style={styles.mapWrap}>
        {initialRegion ? (
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFill}
            provider={PROVIDER_DEFAULT}
            initialRegion={initialRegion}
            showsUserLocation={locStatus === 'granted'}
            showsMyLocationButton
            onPress={() => {
              setSelected(null);
              // Also dismiss the keyboard + close the search dropdown
              // when the user taps the map — makes it easy to get back
              // to the map without picking a club.
              if (searchFocused) {
                setSearchFocused(false);
                Keyboard.dismiss();
              }
            }}
          >
            {clubs.map((c) => (
              <Marker
                key={c.id}
                coordinate={{ latitude: c.latitude, longitude: c.longitude }}
                title={c.name}
                description={`${c.distance_miles} mi away`}
                pinColor={colors.primary}
                // Big perf win when there are many markers: tell RN Maps that
                // the marker view never changes after mount, so it stops
                // re-rendering on every pan/zoom. Trade-off: any dynamic
                // marker content (custom views) won't update, but we're just
                // using the default pin so this is fine.
                tracksViewChanges={false}
                onPress={(e) => {
                  // Stop the map's onPress (which clears selection) from firing.
                  e.stopPropagation?.();
                  setSelected(c);
                }}
              />
            ))}
          </MapView>
        ) : (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
            <Text style={styles.hintText}>
              {locStatus === 'denied'
                ? 'Using your saved home location…'
                : 'Getting your location…'}
            </Text>
          </View>
        )}

        {/* Loading overlay while clubs refresh */}
        {loading && initialRegion && (
          <View style={styles.loadingChip}>
            <ActivityIndicator color={colors.white} size="small" />
            <Text style={styles.loadingChipText}>Loading courses…</Text>
          </View>
        )}

        {/* Course count chip */}
        {!loading && initialRegion && (
          <View style={styles.countChip}>
            <Text style={styles.countChipText}>
              {clubs.length} course{clubs.length === 1 ? '' : 's'}{' '}
              {showAll ? 'total' : `within ${radius} mi`}
            </Text>
          </View>
        )}

        {/* Recentre button (lifts up when a course card is open) */}
        {usedOrigin && initialRegion && (
          <TouchableOpacity
            style={[styles.recentreBtn, selected && styles.recentreBtnLifted]}
            onPress={recentre}
            hitSlop={8}
            accessibilityLabel="Recentre map on your location"
          >
            <Text style={styles.recentreIcon}>📍</Text>
          </TouchableOpacity>
        )}

        {/* Error banner */}
        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{error}</Text>
            <TouchableOpacity onPress={refresh}>
              <Text style={styles.errorRetry}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Selected club bottom card */}
        {selected && (
          <View style={styles.card}>
            {selected.photo_url && (
              <Image
                source={{ uri: selected.photo_url }}
                style={styles.cardHeroImage}
                resizeMode="cover"
              />
            )}
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {selected.name}
                </Text>
                <View style={styles.cardMetaRow}>
                  <Text style={styles.cardDistance}>
                    {selected.distance_miles} miles away
                  </Text>
                  {selected.rating !== null && (
                    <>
                      <Text style={styles.cardMetaDot}>•</Text>
                      <ClubRatingRow
                        rating={selected.rating}
                        count={selected.rating_count}
                      />
                    </>
                  )}
                </View>
              </View>
              <TouchableOpacity onPress={() => setSelected(null)} hitSlop={10}>
                <Text style={styles.cardClose}>✕</Text>
              </TouchableOpacity>
            </View>
            {selected.address && (
              <Text style={styles.cardAddress} numberOfLines={2}>
                {selected.address}
              </Text>
            )}
            <View style={styles.cardBtnRow}>
              {selected.website && (
                <TouchableOpacity
                  style={[styles.cardBtn, styles.cardBtnSecondary]}
                  onPress={() => openWebsite(selected.website!)}
                >
                  <Text style={[styles.cardBtnText, styles.cardBtnSecondaryText]}>
                    Visit website
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.cardBtn}
                onPress={() => postRoundHere(selected.id)}
              >
                <Text style={styles.cardBtnText}>Post round</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

// Simple card used in the web fallback.
function ClubRatingRow({
  rating,
  count,
}: {
  rating: number;
  count: number | null;
}) {
  return (
    <View style={styles.ratingRow}>
      <Text style={styles.ratingStar}>★</Text>
      <Text style={styles.ratingValue}>{rating.toFixed(1)}</Text>
      {count !== null && count > 0 && (
        <Text style={styles.ratingCount}>({count.toLocaleString()})</Text>
      )}
    </View>
  );
}

function ClubCard({
  club,
  onOpenWebsite,
  onPostRound,
}: {
  club: NearbyClub;
  onOpenWebsite: (url: string) => void;
  onPostRound: (clubId: string) => void;
}) {
  return (
    <View style={styles.webCard}>
      {club.photo_url && (
        <Image
          source={{ uri: club.photo_url }}
          style={styles.webCardHeroImage}
          resizeMode="cover"
        />
      )}
      <Text style={styles.cardTitle}>{club.name}</Text>
      <View style={styles.cardMetaRow}>
        <Text style={styles.cardDistance}>{club.distance_miles} miles away</Text>
        {club.rating !== null && (
          <>
            <Text style={styles.cardMetaDot}>•</Text>
            <ClubRatingRow rating={club.rating} count={club.rating_count} />
          </>
        )}
      </View>
      {club.address && <Text style={styles.cardAddress}>{club.address}</Text>}
      <View style={styles.cardBtnRow}>
        {club.website && (
          <TouchableOpacity
            style={[styles.cardBtn, styles.cardBtnSecondary]}
            onPress={() => onOpenWebsite(club.website!)}
          >
            <Text style={[styles.cardBtnText, styles.cardBtnSecondaryText]}>
              Visit website
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.cardBtn}
          onPress={() => onPostRound(club.id)}
        >
          <Text style={styles.cardBtnText}>Post round</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  radiusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  mapSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 8,
  },
  mapSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mapSearchCancel: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  mapSearchCancelText: {
    color: colors.primary,
    fontSize: 15,
    fontWeight: '600',
  },
  mapSearchIcon: {
    fontSize: 14,
    color: colors.textMuted,
  },
  mapSearchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    padding: 0,
    paddingVertical: Platform.OS === 'ios' ? 6 : 2,
  },
  mapSearchClear: {
    fontSize: 16,
    color: colors.textMuted,
    paddingHorizontal: 4,
  },
  searchResultsWrap: {
    backgroundColor: colors.surface,
    maxHeight: 320,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  searchResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 12,
  },
  searchResultName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  searchResultAddress: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  searchResultRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  searchResultStar: {
    fontSize: 12,
    color: '#F5B301',
  },
  searchResultRatingValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  searchEmpty: {
    padding: 20,
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: 14,
  },
  radiusLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginRight: 10,
  },
  radiusPills: {
    flexDirection: 'row',
    flex: 1,
  },
  pill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: colors.surfaceElevated,
    marginRight: 6,
  },
  pillActive: {
    backgroundColor: colors.primary,
  },
  pillText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  pillTextActive: {
    color: colors.white,
  },
  mapWrap: {
    flex: 1,
    position: 'relative',
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  hintText: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 8,
  },
  loadingChip: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 8,
  },
  loadingChipText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  countChip: {
    position: 'absolute',
    top: 12,
    alignSelf: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  recentreBtn: {
    position: 'absolute',
    right: 12,
    bottom: 24,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
    borderWidth: 1,
    borderColor: colors.border,
  },
  recentreBtnLifted: {
    bottom: 180,
  },
  recentreIcon: {
    fontSize: 22,
  },
  countChipText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  errorBanner: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    backgroundColor: colors.danger,
    padding: 12,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  errorBannerText: {
    color: colors.white,
    fontSize: 13,
    flex: 1,
    marginRight: 12,
  },
  errorRetry: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  card: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  cardDistance: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
  },
  cardClose: {
    fontSize: 20,
    color: colors.textMuted,
    padding: 4,
  },
  cardAddress: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 8,
    lineHeight: 18,
  },
  cardHeroImage: {
    width: '100%',
    height: 140,
    borderRadius: 10,
    marginBottom: 12,
    backgroundColor: colors.surfaceElevated,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
    flexWrap: 'wrap',
  },
  cardMetaDot: {
    fontSize: 12,
    color: colors.textMuted,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingStar: {
    fontSize: 13,
    color: '#F5B301', // gold
  },
  ratingValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  ratingCount: {
    fontSize: 12,
    color: colors.textMuted,
  },
  cardBtnRow: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  cardBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    flexGrow: 1,
    alignItems: 'center',
  },
  cardBtnText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  cardBtnSecondary: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  cardBtnSecondaryText: {
    color: colors.primary,
  },
  // Web fallback styles
  webWrap: {
    padding: 24,
    alignItems: 'stretch',
  },
  webEmoji: {
    fontSize: 48,
    textAlign: 'center',
    marginBottom: 12,
  },
  webTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  webSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
  },
  list: {
    marginTop: 8,
    gap: 12,
  },
  webCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  webCardHeroImage: {
    width: '100%',
    height: 160,
    borderRadius: 10,
    marginBottom: 12,
    backgroundColor: colors.surfaceElevated,
  },
  emptyText: {
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 20,
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
    marginTop: 12,
    textAlign: 'center',
  },
});
