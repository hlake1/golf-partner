import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export type PlayingStyle = 'competitive' | 'casual';

export interface Profile {
  id: string;
  full_name: string;
  photo_url: string | null;
  handicap: number | null;
  age: number | null;
  playing_style: PlayingStyle;
  up_for_drink_afterwards: boolean;
  occupation: string | null;
  home_location: unknown | null; // PostGIS geography — we only care if it's set
  search_radius_miles: number;
  created_at: string;
  updated_at: string;
}

// A profile is "complete" once the essentials are filled in.
// Photo, occupation, and club memberships are optional.
export function isProfileComplete(p: Profile | null): boolean {
  if (!p) return false;
  return p.handicap !== null && p.age !== null && p.home_location !== null;
}

export function useProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error: err } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (err) {
      setError(err.message);
      setProfile(null);
    } else {
      setProfile(data as Profile | null);
      setError(null);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  return { profile, loading, error, refresh: load };
}
