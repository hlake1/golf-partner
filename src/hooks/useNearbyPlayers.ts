import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { PlayingStyle } from './useProfile';

export interface NearbyPlayer {
  id: string;
  full_name: string;
  photo_url: string | null;
  handicap: number | null;
  age: number | null;
  playing_style: PlayingStyle;
  up_for_drink_afterwards: boolean;
  occupation: string | null;
  distance_miles: number;
  clubs: { id: string; name: string }[];
}

interface Options {
  radiusMiles: number;
  clubFilter: string | null;
}

/**
 * Calls the nearby_players RPC to get local players within radius,
 * with optional club filter. Origin = current user's home_location.
 */
export function useNearbyPlayers({ radiusMiles, clubFilter }: Options) {
  const { user } = useAuth();
  const [players, setPlayers] = useState<NearbyPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    // 1. Get my current location (from profiles.home_location)
    const { data: me, error: meErr } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();
    if (meErr || !me) {
      setError(meErr?.message ?? 'Could not load your profile.');
      setLoading(false);
      return;
    }

    // 2. Fetch my location as raw lng/lat via a small RPC helper.
    // The PostGIS geography column can't be selected as text via PostgREST
    // without a helper — we use the location stored on our own profile.
    // Since we don't have a RPC for "my location", we call nearby_players
    // with a helper RPC. Simpler: use the RPC directly, letting the DB
    // fetch our location by reading auth.uid() home_location.
    //
    // But the RPC signature we wrote takes origin_lng/origin_lat, so let's
    // read location via a small server-side view. For now, we use a light
    // RPC call. Fallback: cache location in AsyncStorage on onboarding.
    //
    // Cleanest: create a `my_location` RPC. Until then, use the raw
    // location the user just set at onboarding time via a separate query.
    const { data: locData, error: locErr } = await supabase.rpc('my_location');

    if (locErr || !locData) {
      setError(
        locErr?.message ??
          'Could not read your location. Complete onboarding again to set it.'
      );
      setLoading(false);
      return;
    }

    const { lng, lat } = locData as { lng: number; lat: number };

    // 3. Call nearby_players with our location as origin
    const { data, error: err } = await supabase.rpc('nearby_players', {
      origin_lng: lng,
      origin_lat: lat,
      radius_miles: radiusMiles,
      club_filter: clubFilter,
    });

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    const mapped: NearbyPlayer[] = (data ?? []).map((p: any) => ({
      id: p.id,
      full_name: p.full_name,
      photo_url: p.photo_url,
      handicap: p.handicap,
      age: p.age,
      playing_style: p.playing_style,
      up_for_drink_afterwards: p.up_for_drink_afterwards,
      occupation: p.occupation,
      distance_miles: Number(p.distance_miles).toFixed
        ? Number(Number(p.distance_miles).toFixed(1))
        : p.distance_miles,
      clubs: (p.clubs ?? []) as { id: string; name: string }[],
    }));

    setPlayers(mapped);
    setLoading(false);
  }, [user, radiusMiles, clubFilter]);

  useEffect(() => {
    load();
  }, [load]);

  return { players, loading, error, refresh: load };
}
