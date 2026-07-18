import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export interface NearbyClub {
  id: string;
  name: string;
  address: string | null;
  website: string | null;
  latitude: number;
  longitude: number;
  distance_miles: number;
}

interface Options {
  radiusMiles: number;
  /** If provided, use this as origin instead of the user's home_location. */
  origin?: { latitude: number; longitude: number } | null;
}

/**
 * Wraps the `nearby_clubs` PostGIS RPC.
 * If `origin` is given (e.g. current GPS from expo-location), we use it.
 * Otherwise we fall back to the user's saved home_location via the my_location() RPC.
 */
export function useNearbyClubs({ radiusMiles, origin }: Options) {
  const { user } = useAuth();
  const [clubs, setClubs] = useState<NearbyClub[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usedOrigin, setUsedOrigin] = useState<{ latitude: number; longitude: number } | null>(
    null
  );

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    let lng: number;
    let lat: number;

    if (origin) {
      lng = origin.longitude;
      lat = origin.latitude;
    } else {
      const { data: locData, error: locErr } = await supabase.rpc('my_location');
      if (locErr || !locData) {
        setError(
          locErr?.message ??
            'Could not read your location. Complete onboarding again to set it.'
        );
        setLoading(false);
        return;
      }
      const loc = locData as { lng: number; lat: number };
      lng = loc.lng;
      lat = loc.lat;
    }

    setUsedOrigin({ latitude: lat, longitude: lng });

    const { data, error: err } = await supabase.rpc('nearby_clubs', {
      origin_lng: lng,
      origin_lat: lat,
      radius_miles: radiusMiles,
    });

    if (err) {
      setError(err.message);
      setClubs([]);
      setLoading(false);
      return;
    }

    const mapped: NearbyClub[] = (data ?? []).map((c: any) => ({
      id: c.id,
      name: c.name,
      address: c.address,
      website: c.website,
      latitude: Number(c.latitude),
      longitude: Number(c.longitude),
      distance_miles: Number(Number(c.distance_miles).toFixed(1)),
    }));

    setClubs(mapped);
    setLoading(false);
  }, [user, radiusMiles, origin?.latitude, origin?.longitude]);

  useEffect(() => {
    load();
  }, [load]);

  return { clubs, loading, error, refresh: load, usedOrigin };
}
