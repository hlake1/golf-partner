import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
}

interface Props {
  friendId: string;
  friendName: string;
  friendPhoto: string | null;
  onBack: () => void;
}

export default function ChatScreen({ friendId, friendName, friendPhoto, onBack }: Props) {
  const { user } = useAuth();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);

  // Set up conversation + subscription
  useEffect(() => {
    let unsub: (() => void) | undefined;
    (async () => {
      if (!user) return;
      setLoading(true);

      // 1. get_or_create_conversation RPC (this checks friendship indirectly
      // via our RLS on conversations INSERT)
      const { data: convId, error: convErr } = await supabase.rpc(
        'get_or_create_conversation',
        { other_user_id: friendId }
      );
      if (convErr || !convId) {
        Alert.alert('Chat unavailable', convErr?.message ?? 'Could not open chat.');
        setLoading(false);
        return;
      }
      const cid = convId as string;
      setConversationId(cid);

      // 2. Load history
      const { data: msgs } = await supabase
        .from('messages')
        .select('id, conversation_id, sender_id, content, created_at, read_at')
        .eq('conversation_id', cid)
        .order('created_at', { ascending: true })
        .limit(200);
      setMessages((msgs as Message[]) ?? []);
      setLoading(false);

      // 3. Mark inbound as read
      await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('conversation_id', cid)
        .neq('sender_id', user.id)
        .is('read_at', null);

      // 4. Realtime subscription
      const channel = supabase
        .channel(`messages:${cid}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${cid}`,
          },
          (payload) => {
            const m = payload.new as Message;
            setMessages((prev) => {
              if (prev.find((p) => p.id === m.id)) return prev;
              return [...prev, m];
            });
            // Mark as read if it's inbound
            if (m.sender_id !== user.id) {
              supabase
                .from('messages')
                .update({ read_at: new Date().toISOString() })
                .eq('id', m.id);
            }
          }
        )
        .subscribe();

      unsub = () => {
        supabase.removeChannel(channel);
      };
    })();

    return () => {
      unsub?.();
    };
  }, [user, friendId]);

  // Autoscroll on new messages
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }, [messages.length]);

  async function send() {
    if (!user || !conversationId) return;
    const content = draft.trim();
    if (!content) return;
    setSending(true);
    setDraft('');
    const { error } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content,
    });
    setSending(false);
    if (error) {
      Alert.alert('Message failed', error.message);
      setDraft(content); // restore
    }
    // The realtime subscription will pick up the new message and add it to state,
    // but for local snappiness we could also insert optimistically. Skipping for now.
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack}>
            <Text style={styles.backChevron}>‹</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            {friendPhoto ? (
              <Image source={{ uri: friendPhoto }} style={styles.headerAvatar} />
            ) : (
              <View style={styles.headerAvatarPlaceholder}>
                <Text style={styles.headerAvatarInitial}>
                  {friendName.charAt(0)?.toUpperCase() ?? '?'}
                </Text>
              </View>
            )}
            <Text style={styles.headerTitle} numberOfLines={1}>
              {friendName}
            </Text>
          </View>
          <View style={{ width: 32 }} />
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={({ item }) => (
              <MessageBubble message={item} isMine={item.sender_id === user?.id} />
            )}
            contentContainerStyle={styles.messagesList}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>💬</Text>
                <Text style={styles.emptyText}>
                  Say hi to {friendName.split(' ')[0]}!
                </Text>
              </View>
            }
          />
        )}

        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder="Message…"
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={4000}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!draft.trim() || sending) && styles.sendButtonDisabled,
            ]}
            onPress={send}
            disabled={!draft.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <Text style={styles.sendButtonText}>Send</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function MessageBubble({ message, isMine }: { message: Message; isMine: boolean }) {
  const time = new Date(message.created_at).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return (
    <View
      style={[
        styles.bubbleRow,
        isMine ? styles.bubbleRowMine : styles.bubbleRowTheirs,
      ]}
    >
      <View
        style={[
          styles.bubble,
          isMine ? styles.bubbleMine : styles.bubbleTheirs,
        ]}
      >
        <Text style={isMine ? styles.bubbleTextMine : styles.bubbleTextTheirs}>
          {message.content}
        </Text>
        <Text style={isMine ? styles.bubbleTimeMine : styles.bubbleTimeTheirs}>
          {time}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
    gap: 8,
  },
  backChevron: { fontSize: 32, color: colors.primary, width: 32, lineHeight: 32 },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerAvatar: { width: 36, height: 36, borderRadius: 18 },
  headerAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarInitial: { fontSize: 15, fontWeight: '700', color: colors.white },
  headerTitle: { fontSize: 16, fontWeight: '700', color: colors.text, flex: 1 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  messagesList: { padding: 12, paddingBottom: 8, flexGrow: 1 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 14, color: colors.textSecondary, fontWeight: '600' },
  bubbleRow: { flexDirection: 'row', marginVertical: 3 },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubbleRowTheirs: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
  },
  bubbleMine: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleTheirs: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bubbleTextMine: { color: colors.white, fontSize: 15, lineHeight: 20 },
  bubbleTextTheirs: { color: colors.text, fontSize: 15, lineHeight: 20 },
  bubbleTimeMine: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    marginTop: 2,
    textAlign: 'right',
  },
  bubbleTimeTheirs: {
    color: colors.textMuted,
    fontSize: 10,
    marginTop: 2,
    textAlign: 'right',
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    padding: 10,
    paddingBottom: 14,
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.background,
  },
  sendButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    justifyContent: 'center',
    minWidth: 60,
    alignItems: 'center',
  },
  sendButtonDisabled: { opacity: 0.4 },
  sendButtonText: { color: colors.white, fontWeight: '700', fontSize: 14 },
});
