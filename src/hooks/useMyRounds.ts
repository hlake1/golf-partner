import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export type MyRoundRole = 'host' | 'accepted';

export interface MyRound {
  id: string;
  scheduled_for: string; // ISO
  status: 'open' | 'full' | 'completed' | 'cancelled';
  players_needed: number;
  notes: string | null;
  role: MyRoundRole;
  club: { id: string; name: string } | null;
  host: { id: string; full_name: string; photo_url: string | null } | null;
  accepted_players: { id: string; full_name: string; photo_url: string | null }[];
  // Local YYYY-MM-DD (device tz) for calendar dot lookup
  local_date: string;
}

function toLocalDateStr(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Fetches ALL upcoming rounds where the user is either host or an accepted
 * player. Used for the personal calendar view (dots + agenda).
 */
export function useMyRounds() {
  const { user } = useAuth();
  const [rounds, setRounds] = useState<MyRound[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    const nowIso = new Date().toISOString();

    // Two queries in parallel: hosted rounds + accepted-into rounds
    const hostedQuery = supabase
      .from('rounds')
      .select(
        `
        id, scheduled_for, status, players_needed, notes,
        club:clubs(id, name),
        host:profiles!rounds_host_id_fkey(id, full_name, photo_url),
        join_requests(status, requester:profiles(id, full_name, photo_url))
      `
      )
      .eq('host_id', user.id)
      .in('status', ['open', 'full'])
      .gte('scheduled_for', nowIso);

    const acceptedQuery = supabase
      .from('join_requests')
      .select(
        `
        status,
        round:rounds(
          id, scheduled_for, status, players_needed, notes, host_id,
          club:clubs(id, name),
          host:profiles!rounds_host_id_fkey(id, full_name, photo_url),
          join_requests(status, requester:profiles(id, full_name, photo_url))
        )
      `
      )
      .eq('requester_id', user.id)
      .eq('status', 'accepted');

    const [hostedRes, acceptedRes] = await Promise.all([hostedQuery, acceptedQuery]);

    if (hostedRes.error) {
      setError(hostedRes.error.message);
      setLoading(false);
      return;
    }
    if (acceptedRes.error) {
      setError(acceptedRes.error.message);
      setLoading(false);
      return;
    }

    const shape = (row: any, role: MyRoundRole): MyRound => {
      const acceptedPlayers = ((row.join_requests ?? []) as any[])
        .filter((jr: any) => jr.status === 'accepted' && jr.requester)
        .map((jr: any) => jr.requester);
      return {
        id: row.id,
        scheduled_for: row.scheduled_for,
        status: row.status,
        players_needed: row.players_needed,
        notes: row.notes,
        role,
        club: row.club,
        host: row.host,
        accepted_players: acceptedPlayers,
        local_date: toLocalDateStr(row.scheduled_for),
      };
    };

    const hosted = (hostedRes.data ?? []).map((r: any) => shape(r, 'host'));
    const accepted = (acceptedRes.data ?? [])
      .map((r: any) => r.round)
      .filter((r: any) => r && r.status !== 'cancelled' && new Date(r.scheduled_for) >= new Date())
      .map((r: any) => shape(r, 'accepted'));

    // Merge + sort by date
    const merged = [...hosted, ...accepted].sort((a, b) =>
      a.scheduled_for.localeCompare(b.scheduled_for)
    );

    setRounds(merged);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  return { rounds, loading, error, refresh: load };
}
