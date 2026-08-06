import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { PartnerTier } from './useNearbyClubs';

export interface ClubDetail {
  id: string;
  name: string;
  address: string | null;
  website: string | null;
  county: string | null;
  country: string | null;
  photo_url: string | null;
  rating: number | null;
  rating_count: number | null;
  // Partner fields
  is_scramble_partner: boolean;
  partner_tier: PartnerTier | null;
  partner_since: string | null;
  partner_description: string | null;
  partner_photos: string[];
  partner_hero_photo: string | null;
  partner_holes: number | null;
  partner_par: number | null;
  partner_phone: string | null;
  partner_email: string | null;
  partner_managed_by: string | null;
}

/**
 * Load a single club's full record (including partner-facing fields).
 * Used by ClubProfileScreen when the user taps a marker or club card.
 */
export function useClubDetail(clubId: string | null | undefined) {
  const [club, setClub] = useState<ClubDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(!!clubId);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!clubId) {
      setClub(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    const { data, error: err } = await supabase
      .from('clubs')
      .select(
        `id, name, address, website, county, country, photo_url, rating, rating_count,
         is_scramble_partner, partner_tier, partner_since, partner_description,
         partner_photos, partner_hero_photo, partner_holes, partner_par,
         partner_phone, partner_email, partner_managed_by`
      )
      .eq('id', clubId)
      .maybeSingle();

    if (err) {
      setError(err.message);
      setClub(null);
    } else if (data) {
      setClub({
        ...data,
        partner_photos: data.partner_photos ?? [],
      } as ClubDetail);
    } else {
      setClub(null);
    }
    setLoading(false);
  }, [clubId]);

  useEffect(() => {
    load();
  }, [load]);

  return { club, loading, error, refresh: load };
}
