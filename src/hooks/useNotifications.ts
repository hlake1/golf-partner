import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

export type NotificationType =
  | 'join_request'
  | 'request_accepted'
  | 'request_declined'
  | 'new_message'
  | 'round_reminder'
  | 'friend_request'
  | 'friend_accepted';

export interface AppNotification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, any> | null;
  read_at: string | null;
  created_at: string;
}

/**
 * Fetch + realtime-subscribe to the current user's notifications.
 *
 * - `notifications` is ordered newest first
 * - `unreadCount` is derived
 * - `markRead(id)` marks a single notification as read
 * - `markAllRead()` marks everything as read
 * - `refresh()` re-fetches from the server
 */
export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error: err } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);

    if (err) {
      setError(err.message);
      setNotifications([]);
    } else {
      setError(null);
      setNotifications((data as AppNotification[]) ?? []);
    }
    setLoading(false);
  }, [user]);

  // Initial fetch
  useEffect(() => {
    load();
  }, [load]);

  // Realtime subscription: prepend inserts, patch updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as AppNotification;
          setNotifications((prev) => {
            // Avoid duplicates if we also refetched at the same time
            if (prev.some((n) => n.id === row.id)) return prev;
            return [row, ...prev];
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new as AppNotification;
          setNotifications((prev) =>
            prev.map((n) => (n.id === row.id ? row : n))
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const old = payload.old as { id?: string };
          if (!old.id) return;
          setNotifications((prev) => prev.filter((n) => n.id !== old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => n.read_at === null).length,
    [notifications]
  );

  const markRead = useCallback(async (id: string) => {
    // Optimistic UI first
    const now = new Date().toISOString();
    setNotifications((prev) =>
      prev.map((n) => (n.id === id && n.read_at === null ? { ...n, read_at: now } : n))
    );
    const { error: err } = await supabase
      .from('notifications')
      .update({ read_at: now })
      .eq('id', id)
      .is('read_at', null);
    if (err) console.warn('[notifications] markRead failed:', err.message);
  }, []);

  const markAllRead = useCallback(async () => {
    if (!user) return;
    const now = new Date().toISOString();
    // Optimistic UI
    setNotifications((prev) =>
      prev.map((n) => (n.read_at === null ? { ...n, read_at: now } : n))
    );
    const { error: err } = await supabase
      .from('notifications')
      .update({ read_at: now })
      .eq('user_id', user.id)
      .is('read_at', null);
    if (err) console.warn('[notifications] markAllRead failed:', err.message);
  }, [user]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    refresh: load,
    markRead,
    markAllRead,
  };
}
