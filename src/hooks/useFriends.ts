import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export interface Friend {
  id: string;
  full_name: string;
  photo_url: string | null;
  origin: 'friend_request' | 'round_accept';
  since: string;
}

export interface FriendRequest {
  id: string;
  requester_id: string;
  recipient_id: string;
  created_at: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
  other: {
    id: string;
    full_name: string;
    photo_url: string | null;
  };
}

export function useFriends() {
  const { user } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [incoming, setIncoming] = useState<FriendRequest[]>([]);
  const [outgoing, setOutgoing] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // Friends: join through friendships, resolve the "other" side
    const { data: friendRows } = await supabase
      .from('friendships')
      .select(
        `
        user_a, user_b, origin, created_at,
        a:profiles!friendships_user_a_fkey(id, full_name, photo_url),
        b:profiles!friendships_user_b_fkey(id, full_name, photo_url)
      `
      )
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
      .order('created_at', { ascending: false });

    const mappedFriends: Friend[] = (friendRows ?? [])
      .map((row: any) => {
        const other = row.a.id === user.id ? row.b : row.a;
        if (!other) return null;
        return {
          id: other.id,
          full_name: other.full_name,
          photo_url: other.photo_url,
          origin: row.origin,
          since: row.created_at,
        } satisfies Friend;
      })
      .filter((x): x is Friend => x !== null);
    setFriends(mappedFriends);

    // Incoming pending requests
    const { data: incomingRows } = await supabase
      .from('friend_requests')
      .select(
        `id, requester_id, recipient_id, created_at, status,
         other:profiles!friend_requests_requester_id_fkey(id, full_name, photo_url)`
      )
      .eq('recipient_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    setIncoming((incomingRows ?? []) as unknown as FriendRequest[]);

    // Outgoing pending requests
    const { data: outgoingRows } = await supabase
      .from('friend_requests')
      .select(
        `id, requester_id, recipient_id, created_at, status,
         other:profiles!friend_requests_recipient_id_fkey(id, full_name, photo_url)`
      )
      .eq('requester_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    setOutgoing((outgoingRows ?? []) as unknown as FriendRequest[]);

    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  return { friends, incoming, outgoing, loading, refresh: load };
}

/**
 * Utility: what's the current friendship state between me and another user?
 */
export type FriendshipState =
  | 'friends'
  | 'pending_outgoing' // I sent them a request
  | 'pending_incoming' // they sent me a request
  | 'none';

export function useFriendshipState(otherUserId: string | null) {
  const { user } = useAuth();
  const [state, setState] = useState<FriendshipState>('none');
  const [loading, setLoading] = useState(true);
  const [requestId, setRequestId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user || !otherUserId || otherUserId === user.id) {
      setState('none');
      setLoading(false);
      return;
    }
    setLoading(true);

    // Friendship?
    const min = user.id < otherUserId ? user.id : otherUserId;
    const max = user.id < otherUserId ? otherUserId : user.id;
    const { data: fr } = await supabase
      .from('friendships')
      .select('user_a')
      .eq('user_a', min)
      .eq('user_b', max)
      .maybeSingle();
    if (fr) {
      setState('friends');
      setLoading(false);
      return;
    }

    // Pending request?
    const { data: reqs } = await supabase
      .from('friend_requests')
      .select('id, requester_id, recipient_id')
      .eq('status', 'pending')
      .or(
        `and(requester_id.eq.${user.id},recipient_id.eq.${otherUserId}),and(requester_id.eq.${otherUserId},recipient_id.eq.${user.id})`
      );
    const outgoing = reqs?.find((r) => r.requester_id === user.id);
    const incoming = reqs?.find((r) => r.recipient_id === user.id);
    if (outgoing) {
      setState('pending_outgoing');
      setRequestId(outgoing.id);
    } else if (incoming) {
      setState('pending_incoming');
      setRequestId(incoming.id);
    } else {
      setState('none');
      setRequestId(null);
    }
    setLoading(false);
  }, [user, otherUserId]);

  useEffect(() => {
    load();
  }, [load]);

  return { state, loading, requestId, refresh: load };
}
