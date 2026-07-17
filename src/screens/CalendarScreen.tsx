import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { useRounds, type RoundListItem } from '../hooks/useRounds';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import CreateRoundScreen from './CreateRoundScreen';

export default function CalendarScreen() {
  const { user } = useAuth();
  const { rounds, loading, refresh } = useRounds();
  const [creating, setCreating] = useState(false);
  const [requestingId, setRequestingId] = useState<string | null>(null);

  if (creating) {
    return (
      <CreateRoundScreen
        onCancel={() => setCreating(false)}
        onCreated={() => {
          setCreating(false);
          refresh();
        }}
      />
    );
  }

  async function requestToJoin(round: RoundListItem) {
    if (!user) return;
    setRequestingId(round.id);
    const { error } = await supabase.from('join_requests').insert({
      round_id: round.id,
      requester_id: user.id,
      status: 'pending',
    });
    setRequestingId(null);
    if (error) {
      Alert.alert('Could not send request', error.message);
      return;
    }
    Alert.alert(
      'Request sent!',
      `${round.host?.full_name ?? 'The host'} will get a notification and can accept or decline.`
    );
    refresh();
  }

  async function cancelRound(round: RoundListItem) {
    Alert.alert('Cancel this round?', 'People who requested to join will be notified.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Cancel round',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase
            .from('rounds')
            .update({ status: 'cancelled' })
            .eq('id', round.id);
          if (error) Alert.alert('Failed', error.message);
          else refresh();
        },
      },
    ]);
  }

  const myRounds = rounds.filter((r) => r.my_status === 'host');
  const otherRounds = rounds.filter((r) => r.my_status !== 'host');

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Upcoming Rounds</Text>
          <Text style={styles.subtitle}>
            Join a future round, or post your own
          </Text>
        </View>

        <TouchableOpacity style={styles.createButton} onPress={() => setCreating(true)}>
          <Text style={styles.createButtonText}>+ Post a Round</Text>
        </TouchableOpacity>

        {loading && rounds.length === 0 ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : (
          <>
            {myRounds.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>Your rounds</Text>
                {myRounds.map((round) => (
                  <RoundCard
                    key={round.id}
                    round={round}
                    onCancel={() => cancelRound(round)}
                  />
                ))}
              </>
            )}

            <Text style={styles.sectionTitle}>Open rounds</Text>
            {otherRounds.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>⛳</Text>
                <Text style={styles.emptyTitle}>No open rounds nearby</Text>
                <Text style={styles.emptyText}>
                  Be the first — post a round and get players to join you.
                </Text>
              </View>
            ) : (
              otherRounds.map((round) => (
                <RoundCard
                  key={round.id}
                  round={round}
                  onRequestToJoin={() => requestToJoin(round)}
                  requesting={requestingId === round.id}
                />
              ))
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function RoundCard({
  round,
  onRequestToJoin,
  onCancel,
  requesting,
}: {
  round: RoundListItem;
  onRequestToJoin?: () => void;
  onCancel?: () => void;
  requesting?: boolean;
}) {
  const date = new Date(round.scheduled_for);
  const dateText = date.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const timeText = date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const totalSpots = round.players_needed + 1; // +1 for host
  const filled = round.accepted_count + 1;

  return (
    <View style={styles.roundCard}>
      <View style={styles.dateBlock}>
        <Text style={styles.dateText}>{dateText}</Text>
        <Text style={styles.timeText}>{timeText}</Text>
      </View>

      <View style={styles.roundBody}>
        <Text style={styles.roundClub}>{round.club?.name ?? 'Unknown club'}</Text>
        <Text style={styles.roundHost}>
          Hosted by {round.host?.full_name ?? 'Someone'}
        </Text>
        <Text style={styles.roundSpots}>
          {filled} of {totalSpots} spots filled
          {round.pending_count > 0 && ` · ${round.pending_count} pending`}
        </Text>
        {round.notes && (
          <Text style={styles.roundNotes} numberOfLines={2}>
            💬 {round.notes}
          </Text>
        )}

        {round.my_status === 'host' && (
          <View style={styles.hostBadge}>
            <Text style={styles.hostBadgeText}>You're hosting</Text>
            {onCancel && (
              <TouchableOpacity onPress={onCancel}>
                <Text style={styles.cancelLink}>Cancel round</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {round.my_status === 'requested' && (
          <View style={styles.pendingBadge}>
            <Text style={styles.pendingBadgeText}>⏳ Request pending</Text>
          </View>
        )}

        {round.my_status === 'accepted' && (
          <View style={styles.acceptedBadge}>
            <Text style={styles.acceptedBadgeText}>✅ You're in!</Text>
          </View>
        )}

        {round.my_status === 'declined' && (
          <View style={styles.declinedBadge}>
            <Text style={styles.declinedBadgeText}>Request declined</Text>
          </View>
        )}

        {round.my_status === 'none' && onRequestToJoin && (
          <TouchableOpacity
            style={[styles.joinButton, requesting && styles.joinButtonDisabled]}
            onPress={onRequestToJoin}
            disabled={requesting}
          >
            {requesting ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <Text style={styles.joinText}>Request to Join</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingBottom: 40 },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  title: { fontSize: 22, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
  createButton: {
    marginHorizontal: 20,
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 20,
  },
  createButtonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 8,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
    marginHorizontal: 20,
  },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 4 },
  emptyText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  roundCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    gap: 14,
    marginHorizontal: 20,
    marginBottom: 12,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  dateBlock: {
    width: 80,
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateText: { color: colors.white, fontWeight: '700', fontSize: 12, textAlign: 'center' },
  timeText: { color: colors.white, fontSize: 16, fontWeight: '800', marginTop: 4 },
  roundBody: { flex: 1 },
  roundClub: { fontSize: 16, fontWeight: '700', color: colors.text },
  roundHost: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  roundSpots: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  roundNotes: { fontSize: 12, color: colors.textSecondary, marginTop: 6, fontStyle: 'italic' },
  joinButton: {
    marginTop: 10,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  joinButtonDisabled: { opacity: 0.7 },
  joinText: { color: colors.white, fontWeight: '600', fontSize: 13 },
  hostBadge: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  hostBadgeText: { fontSize: 12, fontWeight: '700', color: '#92400E' },
  cancelLink: { fontSize: 12, color: colors.danger, fontWeight: '600' },
  pendingBadge: {
    marginTop: 10,
    backgroundColor: '#DBEAFE',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  pendingBadgeText: { fontSize: 12, fontWeight: '700', color: '#1E40AF' },
  acceptedBadge: {
    marginTop: 10,
    backgroundColor: '#D1FAE5',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  acceptedBadgeText: { fontSize: 12, fontWeight: '700', color: '#065F46' },
  declinedBadge: {
    marginTop: 10,
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  declinedBadgeText: { fontSize: 12, fontWeight: '700', color: '#991B1B' },
});
