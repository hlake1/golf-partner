import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export interface RoundListItem {
  id: string;
  host_id: string;
  club_id: string;
  scheduled_for: string;
  players_needed: number;
  notes: string | null;
  status: 'open' | 'full' | 'completed' | 'cancelled';
  created_at: string;
  club: { id: string; name: string } | null;
  host: { id: string; full_name: string; photo_url: string | null } | null;
  accepted_count: number;
  pending_count: number;
  // Whether the current user has already requested (or is host)
  my_status: 'host' | 'requested' | 'accepted' | 'declined' | 'none';
}

/**
 * Fetches upcoming open rounds (all users), enriched with club + host + counts.
 * Sorted by scheduled_for ascending. Excludes past rounds.
 */
export function useRounds() {
  const { user } = useAuth();
  const [rounds, setRounds] = useState<RoundListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    // Only pull rounds scheduled from now onwards.
    const nowIso = new Date().toISOString();

    const { data, error: err } = await supabase
      .from('rounds')
      .select(
        `
        id,
        host_id,
        club_id,
        scheduled_for,
        players_needed,
        notes,
        status,
        created_at,
        club:clubs(id, name),
        host:profiles!rounds_host_id_fkey(id, full_name, photo_url),
        join_requests(id, requester_id, status)
      `
      )
      .gte('scheduled_for', nowIso)
      .in('status', ['open', 'full'])
      .order('scheduled_for', { ascending: true })
      .limit(100);

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    const mapped: RoundListItem[] = (data ?? []).map((r: any) => {
      const requests = r.join_requests ?? [];
      const accepted = requests.filter((jr: any) => jr.status === 'accepted');
      const pending = requests.filter((jr: any) => jr.status === 'pending');
      const mine = requests.find((jr: any) => jr.requester_id === user.id);
      let my_status: RoundListItem['my_status'];
      if (r.host_id === user.id) my_status = 'host';
      else if (!mine) my_status = 'none';
      else my_status = mine.status;
      return {
        id: r.id,
        host_id: r.host_id,
        club_id: r.club_id,
        scheduled_for: r.scheduled_for,
        players_needed: r.players_needed,
        notes: r.notes,
        status: r.status,
        created_at: r.created_at,
        club: r.club,
        host: r.host,
        accepted_count: accepted.length,
        pending_count: pending.length,
        my_status,
      };
    });

    setRounds(mapped);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  return { rounds, loading, error, refresh: load };
}
