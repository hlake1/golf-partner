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
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { useRounds, type RoundListItem } from '../hooks/useRounds';
import { usePendingRequests, type PendingRequest } from '../hooks/usePendingRequests';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import CreateRoundScreen from './CreateRoundScreen';

export default function CalendarScreen() {
  const { user } = useAuth();
  const { rounds, loading, refresh } = useRounds();
  const { requests, refresh: refreshRequests } = usePendingRequests();
  const [creating, setCreating] = useState(false);
  const [requestingId, setRequestingId] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);

  const refreshAll = () => {
    refresh();
    refreshRequests();
  };

  async function acceptRequest(req: PendingRequest) {
    setActioningId(req.id);
    const { error } = await supabase.rpc('accept_join_request', { request_id: req.id });
    setActioningId(null);
    if (error) {
      Alert.alert('Could not accept', error.message);
      return;
    }
    refreshAll();
  }

  async function declineRequest(req: PendingRequest) {
    Alert.alert(
      `Decline ${req.requester?.full_name ?? 'this request'}?`,
      'They\'ll be notified. You can\'t undo this.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Decline',
          style: 'destructive',
          onPress: async () => {
            setActioningId(req.id);
            const { error } = await supabase.rpc('decline_join_request', {
              request_id: req.id,
              decline_reason: null,
            });
            setActioningId(null);
            if (error) {
              Alert.alert('Could not decline', error.message);
              return;
            }
            refreshAll();
          },
        },
      ]
    );
  }

  if (creating) {
    return (
      <CreateRoundScreen
        onCancel={() => setCreating(false)}
        onCreated={() => {
          setCreating(false);
          refreshAll();
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
    refreshAll();
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
          else refreshAll();
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
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refreshAll} />}
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

        {requests.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>
              ✨ Requests to review ({requests.length})
            </Text>
            {requests.map((req) => (
              <RequestCard
                key={req.id}
                request={req}
                onAccept={() => acceptRequest(req)}
                onDecline={() => declineRequest(req)}
                busy={actioningId === req.id}
              />
            ))}
          </>
        )}

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

function RequestCard({
  request,
  onAccept,
  onDecline,
  busy,
}: {
  request: PendingRequest;
  onAccept: () => void;
  onDecline: () => void;
  busy: boolean;
}) {
  const req = request.requester;
  const round = request.round;
  const initial = req?.full_name?.charAt(0)?.toUpperCase() ?? '?';
  const dateText = round
    ? new Date(round.scheduled_for).toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      })
    : '';
  const timeText = round
    ? new Date(round.scheduled_for).toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';
  const styleTag = req?.playing_style === 'competitive' ? '🏆 Competitive' : '😌 Casual';

  return (
    <View style={styles.requestCard}>
      <View style={styles.requestHeader}>
        {req?.photo_url ? (
          <Image source={{ uri: req.photo_url }} style={styles.requestAvatar} />
        ) : (
          <View style={styles.requestAvatarPlaceholder}>
            <Text style={styles.requestAvatarInitial}>{initial}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.requestName}>{req?.full_name ?? 'Unknown player'}</Text>
          <Text style={styles.requestMeta}>
            {req?.age !== null && req?.age !== undefined ? `Age ${req.age}` : ''}
            {req?.handicap !== null && req?.handicap !== undefined ? ` · HCP ${req.handicap}` : ''}
          </Text>
          {req?.occupation && (
            <Text style={styles.requestOccupation}>💼 {req.occupation}</Text>
          )}
          <View style={styles.requestTagRow}>
            <View style={styles.requestTag}>
              <Text style={styles.requestTagText}>{styleTag}</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.requestRoundInfo}>
        <Text style={styles.requestRoundLabel}>Wants to join:</Text>
        <Text style={styles.requestRoundText}>
          ⛳ {round?.club?.name ?? 'Round'} · {dateText} · {timeText}
        </Text>
      </View>

      {request.message && (
        <Text style={styles.requestMessage}>“{request.message}”</Text>
      )}

      <View style={styles.requestActions}>
        <TouchableOpacity
          style={[styles.declineButton, busy && styles.buttonDisabled]}
          onPress={onDecline}
          disabled={busy}
        >
          <Text style={styles.declineButtonText}>Decline</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.acceptButton, busy && styles.buttonDisabled]}
          onPress={onAccept}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <Text style={styles.acceptButtonText}>Accept</Text>
          )}
        </TouchableOpacity>
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
  // Request card
  requestCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: colors.accent,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  requestHeader: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  requestAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  requestAvatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestAvatarInitial: { fontSize: 22, fontWeight: '700', color: colors.white },
  requestName: { fontSize: 16, fontWeight: '700', color: colors.text },
  requestMeta: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  requestOccupation: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  requestTagRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
  requestTag: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: '#FEF3C7',
  },
  requestTagText: { fontSize: 11, fontWeight: '600', color: colors.text },
  requestRoundInfo: {
    backgroundColor: '#FFF8E7',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  requestRoundLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  requestRoundText: { fontSize: 13, fontWeight: '600', color: colors.text },
  requestMessage: {
    fontSize: 13,
    color: colors.textSecondary,
    fontStyle: 'italic',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  requestActions: { flexDirection: 'row', gap: 10 },
  declineButton: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  declineButtonText: { fontSize: 14, fontWeight: '700', color: colors.text },
  acceptButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  acceptButtonText: { fontSize: 14, fontWeight: '700', color: colors.white },
  buttonDisabled: { opacity: 0.6 },
});
