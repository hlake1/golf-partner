import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import { useNearbyPlayers, type NearbyPlayer } from '../hooks/useNearbyPlayers';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import PlayerProfileScreen from './PlayerProfileScreen';

const RADIUS_OPTIONS = [5, 10, 25, 50];

interface Club {
  id: string;
  name: string;
}

export default function HomeScreen() {
  const { user } = useAuth();
  const [radiusMiles, setRadiusMiles] = useState(10);
  const [clubFilter, setClubFilter] = useState<Club | null>(null);
  const [clubModalOpen, setClubModalOpen] = useState(false);
  const [allClubs, setAllClubs] = useState<Club[]>([]);
  const [openProfileId, setOpenProfileId] = useState<string | null>(null);

  const { players, loading, error, refresh } = useNearbyPlayers({
    radiusMiles,
    clubFilter: clubFilter?.id ?? null,
  });

  if (openProfileId) {
    return (
      <PlayerProfileScreen
        userId={openProfileId}
        onBack={() => setOpenProfileId(null)}
      />
    );
  }

  // Load clubs for the filter modal (once)
  useEffect(() => {
    supabase
      .from('clubs')
      .select('id, name')
      .order('name')
      .then(({ data }) => setAllClubs(data ?? []));
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
      >
        <View style={styles.header}>
          <Text style={styles.greeting}>Local players near you</Text>
          <Text style={styles.subtitle}>
            Tap a player to invite them to a round
          </Text>
        </View>

        {/* Radius filter */}
        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>Search radius</Text>
          <View style={styles.filterRow}>
            {RADIUS_OPTIONS.map((r) => (
              <TouchableOpacity
                key={r}
                style={[
                  styles.filterChip,
                  radiusMiles === r && styles.filterChipActive,
                ]}
                onPress={() => setRadiusMiles(r)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    radiusMiles === r && styles.filterChipTextActive,
                  ]}
                >
                  {r} mi
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Club filter */}
        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>Club</Text>
          <View style={styles.clubFilterRow}>
            <TouchableOpacity
              style={[styles.clubFilterChip, !clubFilter && styles.filterChipActive]}
              onPress={() => setClubFilter(null)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  !clubFilter && styles.filterChipTextActive,
                ]}
              >
                All clubs
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.clubFilterChip, clubFilter && styles.filterChipActive]}
              onPress={() => setClubModalOpen(true)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  clubFilter && styles.filterChipTextActive,
                ]}
                numberOfLines={1}
              >
                {clubFilter ? `⛳ ${clubFilter.name}` : 'Filter by club'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Player results */}
        {error ? (
          <View style={styles.errorState}>
            <Text style={styles.errorEmoji}>😕</Text>
            <Text style={styles.errorTitle}>Couldn't load players</Text>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={refresh}>
              <Text style={styles.retryText}>Try again</Text>
            </TouchableOpacity>
          </View>
        ) : loading && players.length === 0 ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : players.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>⛳</Text>
            <Text style={styles.emptyTitle}>No players nearby</Text>
            <Text style={styles.emptyText}>
              {clubFilter
                ? `No golfers at ${clubFilter.name} within ${radiusMiles} miles.`
                : `Try widening your search radius, or check back later.`}
            </Text>
          </View>
        ) : (
          <View style={styles.playerList}>
            {players.map((player) => (
              <PlayerCard
                key={player.id}
                player={player}
                onOpenProfile={() => setOpenProfileId(player.id)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Club filter modal */}
      <Modal
        visible={clubModalOpen}
        animationType="slide"
        onRequestClose={() => setClubModalOpen(false)}
      >
        <SafeAreaView style={styles.container}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setClubModalOpen(false)}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Filter by Club</Text>
            <View style={{ width: 60 }} />
          </View>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            <TouchableOpacity
              style={styles.clubOption}
              onPress={() => {
                setClubFilter(null);
                setClubModalOpen(false);
              }}
            >
              <Text style={styles.clubOptionName}>All clubs</Text>
              {!clubFilter && <Text style={styles.clubOptionCheck}>✓</Text>}
            </TouchableOpacity>
            {allClubs.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[
                  styles.clubOption,
                  clubFilter?.id === c.id && styles.clubOptionActive,
                ]}
                onPress={() => {
                  setClubFilter(c);
                  setClubModalOpen(false);
                }}
              >
                <Text style={styles.clubOptionName}>⛳ {c.name}</Text>
                {clubFilter?.id === c.id && (
                  <Text style={styles.clubOptionCheck}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function PlayerCard({
  player,
  onOpenProfile,
}: {
  player: NearbyPlayer;
  onOpenProfile: () => void;
}) {
  const { user } = useAuth();
  const [inviting, setInviting] = useState(false);

  async function handleInvite() {
    if (!user) return;
    setInviting(true);

    // Fetch this user's open, future rounds
    const nowIso = new Date().toISOString();
    const { data: myRounds, error: err } = await supabase
      .from('rounds')
      .select('id, scheduled_for, players_needed, notes, club:clubs(name)')
      .eq('host_id', user.id)
      .eq('status', 'open')
      .gte('scheduled_for', nowIso)
      .order('scheduled_for', { ascending: true });

    setInviting(false);

    if (err) {
      Alert.alert('Error', err.message);
      return;
    }

    if (!myRounds || myRounds.length === 0) {
      Alert.alert(
        'No open rounds',
        `Post a round in the Calendar tab first, then invite ${player.full_name} to it.`
      );
      return;
    }

    // Show a picker of the user's rounds
    Alert.alert(
      `Invite ${player.full_name}`,
      'Which round?',
      [
        ...myRounds.map((r: any) => ({
          text: `${new Date(r.scheduled_for).toLocaleDateString('en-GB', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
          })} · ${r.club?.name ?? 'Round'}`,
          onPress: () => sendInvite(r.id, player),
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ],
      { cancelable: true }
    );
  }

  async function sendInvite(roundId: string, player: NearbyPlayer) {
    // Create a join_request from the *host* side, pre-accepted, as an invitation.
    // Then the player gets a notification and can chat with the host.
    //
    // For MVP, we just create a pending join_request with the player as requester,
    // but flipped: the player accepts to join. Because our RLS blocks other users
    // from writing join_requests, we insert a notification directly instead.
    const { error } = await supabase.from('notifications').insert({
      user_id: player.id,
      type: 'join_request',
      title: `You've been invited to a round`,
      body: `Check the Calendar tab to see the invitation.`,
      data: { round_id: roundId, from_user_id: user?.id },
    });

    if (error) {
      Alert.alert('Failed to invite', error.message);
      return;
    }
    Alert.alert('Invitation sent!', `${player.full_name} will see the invite in their notifications.`);
  }

  const styleTag = player.playing_style === 'competitive' ? '🏆 Competitive' : '😌 Casual';
  const initial = player.full_name?.charAt(0)?.toUpperCase() ?? '?';

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.7} onPress={onOpenProfile}>
      <View style={styles.avatarWrap}>
        {player.photo_url ? (
          <Image source={{ uri: player.photo_url }} style={styles.avatarImage} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarInitial}>{initial}</Text>
          </View>
        )}
      </View>

      <View style={styles.cardBody}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.playerName}>{player.full_name}</Text>
          <Text style={styles.distance}>{player.distance_miles} mi</Text>
        </View>

        <Text style={styles.playerMeta}>
          {player.age !== null && `Age ${player.age} · `}
          {player.handicap !== null && `HCP ${player.handicap}`}
        </Text>

        {player.clubs.length > 0 && (
          <Text style={styles.playerClubs} numberOfLines={1}>
            ⛳ {player.clubs.map((c) => c.name).join(', ')}
          </Text>
        )}

        {player.occupation && (
          <Text style={styles.playerOccupation}>💼 {player.occupation}</Text>
        )}

        <View style={styles.tagRow}>
          <View
            style={[
              styles.tag,
              player.playing_style === 'competitive'
                ? styles.tagCompetitive
                : styles.tagCasual,
            ]}
          >
            <Text style={styles.tagText}>{styleTag}</Text>
          </View>
          {player.up_for_drink_afterwards && (
            <View style={[styles.tag, styles.tagDrink]}>
              <Text style={styles.tagText}>🍺 Drinks after</Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[styles.joinButton, inviting && styles.joinButtonDisabled]}
          onPress={handleInvite}
          disabled={inviting}
        >
          {inviting ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={styles.joinButtonText}>⛳ Invite to a Round</Text>
          )}
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingBottom: 24 },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  greeting: { fontSize: 22, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 4 },
  filterSection: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  filterLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  filterRow: { flexDirection: 'row', gap: 8 },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  filterChipTextActive: { color: colors.white },
  clubFilterRow: { flexDirection: 'row', gap: 8 },
  clubFilterChip: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  emptyState: { alignItems: 'center', padding: 40, marginTop: 12 },
  emptyEmoji: { fontSize: 56, marginBottom: 12 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: 4 },
  emptyText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  errorState: { alignItems: 'center', padding: 40, marginTop: 12 },
  errorEmoji: { fontSize: 56, marginBottom: 12 },
  errorTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: 4 },
  errorText: { fontSize: 12, color: colors.danger, textAlign: 'center', marginBottom: 16 },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryText: { color: colors.white, fontWeight: '700' },
  playerList: {
    paddingHorizontal: 20,
    gap: 12,
    marginTop: 12,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    gap: 14,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  avatarWrap: { width: 60 },
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: { width: 60, height: 60, borderRadius: 30 },
  avatarInitial: { fontSize: 24, fontWeight: '700', color: colors.white },
  cardBody: { flex: 1 },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  playerName: { fontSize: 17, fontWeight: '700', color: colors.text, flex: 1 },
  distance: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  playerMeta: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  playerClubs: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  playerOccupation: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  tagRow: { flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  tagCompetitive: { backgroundColor: '#FEF3C7' },
  tagCasual: { backgroundColor: '#D1FAE5' },
  tagDrink: { backgroundColor: '#FEE2E2' },
  tagText: { fontSize: 11, fontWeight: '600', color: colors.text },
  joinButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  joinButtonDisabled: { opacity: 0.6 },
  joinButtonText: { color: colors.white, fontWeight: '700', fontSize: 14 },
  // Modal
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  modalCancel: { color: colors.primary, fontSize: 15, fontWeight: '600', width: 60 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  clubOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: colors.border,
  },
  clubOptionActive: { borderColor: colors.primary, backgroundColor: '#F0F7F2' },
  clubOptionName: { fontSize: 15, fontWeight: '600', color: colors.text, flex: 1 },
  clubOptionCheck: { fontSize: 22, color: colors.primary, fontWeight: '800' },
});
