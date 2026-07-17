import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';

const MOCK_CHATS = [
  {
    id: '1',
    name: 'James Wilson',
    lastMessage: 'Sounds good, see you Saturday at 9!',
    unread: 2,
    lastAt: '10:22',
  },
  {
    id: '2',
    name: 'Sarah Mitchell',
    lastMessage: 'What handicap are you playing off?',
    unread: 0,
    lastAt: 'Yesterday',
  },
];

export default function ChatListScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {MOCK_CHATS.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emoji}>💬</Text>
            <Text style={styles.emptyTitle}>No messages yet</Text>
            <Text style={styles.emptyText}>
              When you invite someone to a round, your chat with them will show up here.
            </Text>
          </View>
        ) : (
          MOCK_CHATS.map((chat) => (
            <TouchableOpacity key={chat.id} style={styles.chatRow}>
              <View style={styles.chatAvatar}>
                <Text style={styles.chatAvatarInitial}>
                  {chat.name.charAt(0)}
                </Text>
              </View>

              <View style={styles.chatBody}>
                <View style={styles.chatHeader}>
                  <Text style={styles.chatName}>{chat.name}</Text>
                  <Text style={styles.chatTime}>{chat.lastAt}</Text>
                </View>
                <Text
                  style={[
                    styles.chatPreview,
                    chat.unread > 0 && styles.chatPreviewUnread,
                  ]}
                  numberOfLines={1}
                >
                  {chat.lastMessage}
                </Text>
              </View>

              {chat.unread > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadText}>{chat.unread}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingVertical: 8,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginTop: 80,
  },
  emoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
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
  chatAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatAvatarInitial: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.white,
  },
  chatBody: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  chatName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  chatTime: {
    fontSize: 12,
    color: colors.textMuted,
  },
  chatPreview: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  chatPreviewUnread: {
    color: colors.text,
    fontWeight: '600',
  },
  unreadBadge: {
    backgroundColor: colors.accent,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
});
