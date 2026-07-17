import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export interface PendingRequest {
  id: string; // join_request id
  round_id: string;
  requester_id: string;
  message: string | null;
  created_at: string;
  round: {
    id: string;
    scheduled_for: string;
    players_needed: number;
    club: { id: string; name: string } | null;
  } | null;
  requester: {
    id: string;
    full_name: string;
    photo_url: string | null;
    handicap: number | null;
    age: number | null;
    playing_style: 'competitive' | 'casual';
    occupation: string | null;
  } | null;
}

/**
 * Fetches all pending join_requests for rounds the current user hosts.
 * These are the ones the host needs to accept or decline.
 */
export function usePendingRequests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    // Step 1: get my hosted round ids that are still open + future
    const nowIso = new Date().toISOString();
    const { data: myRounds, error: roundsErr } = await supabase
      .from('rounds')
      .select('id')
      .eq('host_id', user.id)
      .in('status', ['open', 'full'])
      .gte('scheduled_for', nowIso);

    if (roundsErr) {
      setError(roundsErr.message);
      setLoading(false);
      return;
    }

    const roundIds = (myRounds ?? []).map((r: any) => r.id);
    if (roundIds.length === 0) {
      setRequests([]);
      setLoading(false);
      return;
    }

    // Step 2: fetch pending join_requests for those rounds, with requester + round detail
    const { data, error: err } = await supabase
      .from('join_requests')
      .select(
        `
        id,
        round_id,
        requester_id,
        message,
        created_at,
        round:rounds(id, scheduled_for, players_needed, club:clubs(id, name)),
        requester:profiles(id, full_name, photo_url, handicap, age, playing_style, occupation)
      `
      )
      .in('round_id', roundIds)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    setRequests((data ?? []) as unknown as PendingRequest[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  return { requests, loading, error, refresh: load };
}
