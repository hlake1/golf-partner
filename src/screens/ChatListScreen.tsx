import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useFriends, type Friend, type FriendRequest } from '../hooks/useFriends';
import ChatScreen from './ChatScreen';
import PlayerProfileScreen from './PlayerProfileScreen';

interface ChatSummary {
  conversation_id: string;
  other: { id: string; full_name: string; photo_url: string | null };
  last_message: { content: string; created_at: string; sender_id: string } | null;
  unread_count: number;
  updated_at: string;
}

type Mode = 'chats' | 'friends';
type OpenScreen =
  | { kind: 'none' }
  | { kind: 'chat'; friend: Friend | { id: string; full_name: string; photo_url: string | null } }
  | { kind: 'profile'; userId: string };

export default function ChatListScreen() {
  const { user } = useAuth();
  const { friends, incoming, outgoing, refresh: refreshFriends } = useFriends();
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [chatsLoading, setChatsLoading] = useState(true);
  const [mode, setMode] = useState<Mode>('chats');
  const [open, setOpen] = useState<OpenScreen>({ kind: 'none' });
  const [actioningId, setActioningId] = useState<string | null>(null);

  const loadChats = useCallback(async () => {
    if (!user) return;
    setChatsLoading(true);
    // Pull my conversations + latest message
    const { data: convs } = await supabase
      .from('conversations')
      .select(
        `
        id, user_a, user_b, updated_at, last_message_at,
        a:profiles!conversations_user_a_fkey(id, full_name, photo_url),
        b:profiles!conversations_user_b_fkey(id, full_name, photo_url)
      `
      )
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
      .order('last_message_at', { ascending: false });

    const summaries: ChatSummary[] = [];
    for (const c of (convs ?? []) as any[]) {
      const other = c.a.id === user.id ? c.b : c.a;
      const { data: lastMsg } = await supabase
        .from('messages')
        .select('content, created_at, sender_id')
        .eq('conversation_id', c.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      const { count: unread } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', c.id)
        .neq('sender_id', user.id)
        .is('read_at', null);
      summaries.push({
        conversation_id: c.id,
        other,
        last_message: lastMsg as any,
        unread_count: unread ?? 0,
        updated_at: c.last_message_at,
      });
    }
    // Only show conversations that have at least one message
    setChats(summaries.filter((s) => s.last_message !== null));
    setChatsLoading(false);
  }, [user]);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  // Refresh chats when a chat screen closes
  const closeAndRefresh = () => {
    setOpen({ kind: 'none' });
    loadChats();
    refreshFriends();
  };

  if (open.kind === 'chat') {
    return (
      <ChatScreen
        friendId={open.friend.id}
        friendName={open.friend.full_name}
        friendPhoto={open.friend.photo_url}
        onBack={closeAndRefresh}
      />
    );
  }
  if (open.kind === 'profile') {
    return (
      <PlayerProfileScreen
        userId={open.userId}
        onBack={closeAndRefresh}
        onOpenChat={(id) => {
          const f = friends.find((f) => f.id === id);
          if (f) setOpen({ kind: 'chat', friend: f });
        }}
      />
    );
  }

  async function acceptRequest(req: FriendRequest) {
    setActioningId(req.id);
    const { error } = await supabase.rpc('accept_friend_request', {
      request_id: req.id,
    });
    setActioningId(null);
    if (error) {
      Alert.alert('Could not accept', error.message);
      return;
    }
    refreshFriends();
  }

  async function declineRequest(req: FriendRequest) {
    setActioningId(req.id);
    const { error } = await supabase.rpc('decline_friend_request', {
      request_id: req.id,
    });
    setActioningId(null);
    if (error) {
      Alert.alert('Could not decline', error.message);
      return;
    }
    refreshFriends();
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      {/* Segment control */}
      <View style={styles.segmentBar}>
        <TouchableOpacity
          style={[styles.segment, mode === 'chats' && styles.segmentActive]}
          onPress={() => setMode('chats')}
        >
          <Text style={[styles.segmentText, mode === 'chats' && styles.segmentTextActive]}>
            Chats
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segment, mode === 'friends' && styles.segmentActive]}
          onPress={() => setMode('friends')}
        >
          <Text style={[styles.segmentText, mode === 'friends' && styles.segmentTextActive]}>
            Friends {incoming.length > 0 && `(${incoming.length})`}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={
          <RefreshControl
            refreshing={chatsLoading}
            onRefresh={() => {
              loadChats();
              refreshFriends();
            }}
          />
        }
      >
        {mode === 'chats' ? (
          chatsLoading && chats.length === 0 ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
          ) : chats.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyEmoji}>💬</Text>
              <Text style={styles.emptyTitle}>No conversations yet</Text>
              <Text style={styles.emptyText}>
                Add friends first, then start a chat from their profile.
              </Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => setMode('friends')}
              >
                <Text style={styles.emptyBtnText}>Go to Friends</Text>
              </TouchableOpacity>
            </View>
          ) : (
            chats.map((c) => (
              <TouchableOpacity
                key={c.conversation_id}
                style={styles.chatRow}
                onPress={() =>
                  setOpen({
                    kind: 'chat',
                    friend: {
                      id: c.other.id,
                      full_name: c.other.full_name,
                      photo_url: c.other.photo_url,
                    },
                  })
                }
              >
                {c.other.photo_url ? (
                  <Image source={{ uri: c.other.photo_url }} style={styles.chatAvatar} />
                ) : (
                  <View style={styles.chatAvatarPlaceholder}>
                    <Text style={styles.chatAvatarInitial}>
                      {c.other.full_name.charAt(0)?.toUpperCase() ?? '?'}
                    </Text>
                  </View>
                )}
                <View style={styles.chatBody}>
                  <View style={styles.chatHeader}>
                    <Text style={styles.chatName}>{c.other.full_name}</Text>
                    <Text style={styles.chatTime}>
                      {relTime(c.last_message?.created_at)}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.chatPreview,
                      c.unread_count > 0 && styles.chatPreviewUnread,
                    ]}
                    numberOfLines={1}
                  >
                    {c.last_message?.sender_id === user?.id ? 'You: ' : ''}
                    {c.last_message?.content ?? ''}
                  </Text>
                </View>
                {c.unread_count > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadText}>{c.unread_count}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))
          )
        ) : (
          <>
            {incoming.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>
                  Friend Requests ({incoming.length})
                </Text>
                {incoming.map((req) => (
                  <View key={req.id} style={styles.requestRow}>
                    <TouchableOpacity
                      style={styles.requestAvatarWrap}
                      onPress={() => setOpen({ kind: 'profile', userId: req.other.id })}
                    >
                      {req.other.photo_url ? (
                        <Image
                          source={{ uri: req.other.photo_url }}
                          style={styles.chatAvatar}
                        />
                      ) : (
                        <View style={styles.chatAvatarPlaceholder}>
                          <Text style={styles.chatAvatarInitial}>
                            {req.other.full_name.charAt(0)?.toUpperCase() ?? '?'}
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.chatName}>{req.other.full_name}</Text>
                      <Text style={styles.chatPreview}>wants to be friends</Text>
                    </View>
                    <View style={styles.requestActions}>
                      <TouchableOpacity
                        style={styles.declineBtn}
                        onPress={() => declineRequest(req)}
                        disabled={actioningId === req.id}
                      >
                        <Text style={styles.declineBtnText}>Decline</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.acceptBtn}
                        onPress={() => acceptRequest(req)}
                        disabled={actioningId === req.id}
                      >
                        {actioningId === req.id ? (
                          <ActivityIndicator color={colors.white} size="small" />
                        ) : (
                          <Text style={styles.acceptBtnText}>Accept</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </>
            )}

            <Text style={styles.sectionTitle}>Friends ({friends.length})</Text>
            {friends.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>👥</Text>
                <Text style={styles.emptyTitle}>No friends yet</Text>
                <Text style={styles.emptyText}>
                  Find people on the Home tab, or accept someone into your round.
                </Text>
              </View>
            ) : (
              friends.map((f) => (
                <TouchableOpacity
                  key={f.id}
                  style={styles.chatRow}
                  onPress={() =>
                    setOpen({
                      kind: 'chat',
                      friend: f,
                    })
                  }
                >
                  {f.photo_url ? (
                    <Image source={{ uri: f.photo_url }} style={styles.chatAvatar} />
                  ) : (
                    <View style={styles.chatAvatarPlaceholder}>
                      <Text style={styles.chatAvatarInitial}>
                        {f.full_name.charAt(0)?.toUpperCase() ?? '?'}
                      </Text>
                    </View>
                  )}
                  <View style={styles.chatBody}>
                    <Text style={styles.chatName}>{f.full_name}</Text>
                    <Text style={styles.chatPreview}>
                      {f.origin === 'round_accept' ? '⛳ Met via a round' : '👋 Friend'}
                    </Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </TouchableOpacity>
              ))
            )}

            {outgoing.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Requests Sent</Text>
                {outgoing.map((req) => (
                  <View key={req.id} style={styles.chatRow}>
                    {req.other.photo_url ? (
                      <Image
                        source={{ uri: req.other.photo_url }}
                        style={styles.chatAvatar}
                      />
                    ) : (
                      <View style={styles.chatAvatarPlaceholder}>
                        <Text style={styles.chatAvatarInitial}>
                          {req.other.full_name.charAt(0)?.toUpperCase() ?? '?'}
                        </Text>
                      </View>
                    )}
                    <View style={styles.chatBody}>
                      <Text style={styles.chatName}>{req.other.full_name}</Text>
                      <Text style={styles.chatPreview}>⏳ Request pending</Text>
                    </View>
                  </View>
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function relTime(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diffMin = (now.getTime() - d.getTime()) / 60000;
  if (diffMin < 1) return 'now';
  if (diffMin < 60) return `${Math.floor(diffMin)}m`;
  if (diffMin < 60 * 24)
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const diffDays = diffMin / (60 * 24);
  if (diffDays < 7) return d.toLocaleDateString('en-GB', { weekday: 'short' });
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  segmentBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    padding: 4,
  },
  segment: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  segmentActive: {
    backgroundColor: colors.surface,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  segmentText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  segmentTextActive: { color: colors.primary },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    marginTop: 30,
  },
  emptyEmoji: { fontSize: 60, marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: 4 },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  emptyBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  emptyBtnText: { color: colors.white, fontWeight: '700' },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  chatAvatar: { width: 52, height: 52, borderRadius: 26 },
  chatAvatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatAvatarInitial: { fontSize: 20, fontWeight: '700', color: colors.white },
  chatBody: { flex: 1 },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  chatName: { fontSize: 16, fontWeight: '700', color: colors.text },
  chatTime: { fontSize: 12, color: colors.textMuted },
  chatPreview: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },
  chatPreviewUnread: { color: colors.text, fontWeight: '600' },
  unreadBadge: {
    backgroundColor: colors.accent,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  chevron: { fontSize: 24, color: colors.textMuted, fontWeight: '300' },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  requestAvatarWrap: {},
  requestActions: { flexDirection: 'row', gap: 6 },
  declineBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  declineBtnText: { fontSize: 13, fontWeight: '600', color: colors.text },
  acceptBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.primary,
    minWidth: 70,
    alignItems: 'center',
  },
  acceptBtnText: { fontSize: 13, fontWeight: '700', color: colors.white },
});
