import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { useNotifications, AppNotification, NotificationType } from '../hooks/useNotifications';

interface Props {
  onBack: () => void;
  // Optional deep-link callbacks. If provided, we'll call them when a notification is tapped.
  onOpenRound?: (roundId: string) => void;
  onOpenConversation?: (conversationId: string) => void;
  onOpenFriendRequests?: () => void;
  onOpenPlayer?: (userId: string) => void;
}

const TYPE_META: Record<NotificationType, { emoji: string; label: string }> = {
  join_request: { emoji: '👋', label: 'Join request' },
  request_accepted: { emoji: '✅', label: 'Accepted' },
  request_declined: { emoji: '❌', label: 'Declined' },
  new_message: { emoji: '💬', label: 'Message' },
  round_reminder: { emoji: '⏰', label: 'Reminder' },
  friend_request: { emoji: '🤝', label: 'Friend request' },
  friend_accepted: { emoji: '🎉', label: 'New friend' },
};

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const s = Math.max(1, Math.round((now - then) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function NotificationsScreen({
  onBack,
  onOpenRound,
  onOpenConversation,
  onOpenFriendRequests,
  onOpenPlayer,
}: Props) {
  const {
    notifications,
    unreadCount,
    loading,
    refresh,
    markRead,
    markAllRead,
  } = useNotifications();

  const handleTap = (n: AppNotification) => {
    if (n.read_at === null) markRead(n.id);

    const data = n.data ?? {};
    switch (n.type) {
      case 'join_request':
      case 'request_accepted':
      case 'request_declined':
      case 'round_reminder': {
        const roundId = data.round_id as string | undefined;
        if (roundId && onOpenRound) onOpenRound(roundId);
        break;
      }
      case 'new_message': {
        const convoId = data.conversation_id as string | undefined;
        if (convoId && onOpenConversation) onOpenConversation(convoId);
        break;
      }
      case 'friend_request': {
        if (onOpenFriendRequests) onOpenFriendRequests();
        break;
      }
      case 'friend_accepted': {
        const friendId = data.friend_id as string | undefined;
        if (friendId && onOpenPlayer) onOpenPlayer(friendId);
        break;
      }
    }
  };

  const renderItem = ({ item }: { item: AppNotification }) => {
    const meta = TYPE_META[item.type] ?? { emoji: '🔔', label: 'Notification' };
    const isUnread = item.read_at === null;

    return (
      <TouchableOpacity
        style={[styles.item, isUnread && styles.itemUnread]}
        onPress={() => handleTap(item)}
        activeOpacity={0.7}
      >
        <View style={styles.itemLeft}>
          <Text style={styles.emoji}>{meta.emoji}</Text>
        </View>
        <View style={styles.itemBody}>
          <View style={styles.itemHeader}>
            <Text style={styles.itemTitle} numberOfLines={1}>
              {item.title}
            </Text>
            {isUnread && <View style={styles.dot} />}
          </View>
          <Text style={styles.itemMessage} numberOfLines={2}>
            {item.body}
          </Text>
          <Text style={styles.itemMeta}>
            {meta.label} · {timeAgo(item.created_at)}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const headerRight = useMemo(() => {
    if (unreadCount === 0) return null;
    return (
      <TouchableOpacity onPress={markAllRead} style={styles.headerBtn}>
        <Text style={styles.headerBtnText}>Mark all read</Text>
      </TouchableOpacity>
    );
  }, [unreadCount, markAllRead]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.headerBtn} hitSlop={10}>
          <Text style={styles.headerBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          Notifications{unreadCount > 0 ? ` (${unreadCount})` : ''}
        </Text>
        {headerRight ?? <View style={styles.headerSpacer} />}
      </View>

      {loading && notifications.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>🔔</Text>
          <Text style={styles.emptyTitle}>You're all caught up</Text>
          <Text style={styles.emptyBody}>
            New join requests, messages, and matches will show up here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(n) => n.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 24 }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={
            <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: colors.primary,
  },
  headerTitle: {
    color: colors.white,
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  headerBtn: {
    minWidth: 80,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  headerSpacer: {
    minWidth: 80,
  },
  headerBtnText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
  },
  emptyBody: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  item: {
    flexDirection: 'row',
    padding: 14,
    backgroundColor: colors.surface,
  },
  itemUnread: {
    backgroundColor: colors.surfaceElevated,
  },
  itemLeft: {
    width: 40,
    alignItems: 'center',
    paddingTop: 2,
  },
  emoji: {
    fontSize: 22,
  },
  itemBody: {
    flex: 1,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  itemTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
    marginLeft: 8,
  },
  itemMessage: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  itemMeta: {
    fontSize: 12,
    color: colors.textMuted,
  },
  separator: {
    height: 1,
    backgroundColor: colors.divider,
  },
});
