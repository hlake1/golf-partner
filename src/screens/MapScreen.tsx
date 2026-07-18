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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
  const [radius, setRadius] = useState<number>(profile?.search_radius_miles ?? 10);
  const [liveOrigin, setLiveOrigin] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [locStatus, setLocStatus] = useState<'idle' | 'asking' | 'granted' | 'denied'>(
    'idle'
  );
  const [selected, setSelected] = useState<NearbyClub | null>(null);
  const [showAll, setShowAll] = useState(false);
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
                <ClubCard key={c.id} club={c} onOpenWebsite={openWebsite} />
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
            onPress={() => setSelected(null)}
          >
            {clubs.map((c) => (
              <Marker
                key={c.id}
                coordinate={{ latitude: c.latitude, longitude: c.longitude }}
                title={c.name}
                description={`${c.distance_miles} mi away`}
                pinColor={colors.primary}
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
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {selected.name}
                </Text>
                <Text style={styles.cardDistance}>
                  {selected.distance_miles} miles away
                </Text>
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
            {selected.website && (
              <TouchableOpacity
                style={styles.cardBtn}
                onPress={() => openWebsite(selected.website!)}
              >
                <Text style={styles.cardBtnText}>Visit website</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

// Simple card used in the web fallback.
function ClubCard({
  club,
  onOpenWebsite,
}: {
  club: NearbyClub;
  onOpenWebsite: (url: string) => void;
}) {
  return (
    <View style={styles.webCard}>
      <Text style={styles.cardTitle}>{club.name}</Text>
      <Text style={styles.cardDistance}>{club.distance_miles} miles away</Text>
      {club.address && <Text style={styles.cardAddress}>{club.address}</Text>}
      {club.website && (
        <TouchableOpacity
          style={styles.cardBtn}
          onPress={() => onOpenWebsite(club.website!)}
        >
          <Text style={styles.cardBtnText}>Visit website</Text>
        </TouchableOpacity>
      )}
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
  cardBtn: {
    marginTop: 12,
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  cardBtnText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
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
